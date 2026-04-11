import requests
from bs4 import BeautifulSoup
import json
import re
from typing import Dict, List, Any, Optional
from pathlib import Path
from sqlalchemy import Engine
import chromadb

from tools.parser_tools import parse_table_to_metrics_records, batch_insert_financial_metrics
from tools.chroma_tools import generate_chunks_from_table, embed_text_chunks

class ScreenerScraper:
    """Scrape structured financial data and document links from screener.in."""
    
    BASE_URL = "https://www.screener.in"
    
    def __init__(self, ticker: str, db_engine: Optional[Engine] = None, chroma_client: Optional[chromadb.Client] = None):
        self.ticker = ticker.upper()
        self.url = f"{self.BASE_URL}/company/{self.ticker}/"
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        })
        self.db_engine = db_engine
        self.chroma_client = chroma_client
    
    def fetch_page(self) -> BeautifulSoup:
        """Fetch the company page and return BeautifulSoup object."""
        resp = self.session.get(self.url)
        resp.raise_for_status()
        return BeautifulSoup(resp.text, "lxml")
    
    def extract_quarterly_results(self, soup: BeautifulSoup) -> Dict:
        """Extract the quarterly results table."""
        table = soup.find("table", {"class": "data-table"})
        if not table:
            return {}
        headers = [th.text.strip() for th in table.find_all("th")]
        rows = {}
        for tr in table.find_all("tr")[1:]:
            cells = tr.find_all("td")
            if not cells:
                continue
            label = cells[0].text.strip()
            values = [cell.text.strip() for cell in cells[1:]]
            rows[label] = values
        return {"headers": headers[1:], "rows": rows}
    
    def extract_annual_financials(self, soup: BeautifulSoup, section_id: str) -> Dict:
        """Extract annual tables (P&L, balance sheet, cash flow, ratios)."""
        section = soup.find("section", {"id": section_id})
        if not section:
            return {}
        table = section.find("table", {"class": "data-table"})
        if not table:
            return {}
        headers = [th.text.strip() for th in table.find_all("th")]
        rows = {}
        for tr in table.find_all("tr")[1:]:
            cells = tr.find_all("td")
            if not cells:
                continue
            label = cells[0].text.strip()
            values = [cell.text.strip() for cell in cells[1:]]
            rows[label] = values
        return {"headers": headers[1:], "rows": rows}
    
    def extract_shareholding(self, soup: BeautifulSoup) -> List[Dict]:
        """Extract quarterly shareholding pattern."""
        section = soup.find("section", {"id": "shareholding"})
        if not section:
            return []
        table = section.find("table", {"class": "data-table"})
        if not table:
            return []
        headers = [th.text.strip() for th in table.find_all("th")]
        data = []
        for tr in table.find_all("tr")[1:]:
            cells = tr.find_all("td")
            if not cells:
                continue
            row = {headers[i]: cells[i].text.strip() for i in range(len(cells))}
            data.append(row)
        return data
    
    def extract_pros_cons(self, soup: BeautifulSoup) -> Dict[str, List[str]]:
        """Extract pros and cons from the analysis section."""
        section = soup.find("section", {"id": "analysis"})
        if not section:
            return {"pros": [], "cons": []}
        pros_cons = {"pros": [], "cons": []}
        current = None
        for li in section.find_all("li"):
            text = li.text.strip()
            if "pros" in text.lower():
                current = "pros"
            elif "cons" in text.lower():
                current = "cons"
            elif current and text:
                pros_cons[current].append(text)
        return pros_cons
    
    def extract_document_links(self, soup: BeautifulSoup) -> Dict[str, List[Dict]]:
        """
        Extract links to annual reports, concall transcripts, and credit ratings.
        Returns dict with keys: 'annual_reports', 'concalls', 'credit_ratings'.
        """
        docs = {"annual_reports": [], "concalls": [], "credit_ratings": []}
        
        # 1. Annual Reports – often inside an iframe with id "doc_iframe"
        iframe = soup.find("iframe", id="doc_iframe")
        if iframe and iframe.get("src"):
            pdf_url = iframe["src"]
            if pdf_url.startswith("//"):
                pdf_url = "https:" + pdf_url
            elif not pdf_url.startswith("http"):
                pdf_url = self.BASE_URL + pdf_url
            docs["annual_reports"].append({"year": "latest", "link": pdf_url})
            print(f"✅ Found annual report PDF via iframe: {pdf_url}")
        else:
            # Fallback: look for section with id "annual-reports"
            annual_section = soup.find("section", {"id": "annual-reports"})
            if annual_section:
                for a in annual_section.find_all("a", href=True):
                    if a.text.strip().isdigit() or ".pdf" in a["href"]:
                        year = a.text.strip() if a.text.strip().isdigit() else "unknown"
                        link = a["href"]
                        if not link.startswith("http"):
                            link = self.BASE_URL + link
                        docs["annual_reports"].append({"year": year, "link": link})
                        print(f"✅ Found annual report: {year} -> {link}")
        
        # 2. Concall Transcripts
        concall_section = soup.find("section", {"id": "concalls"})
        if concall_section:
            for a in concall_section.find_all("a", href=True):
                text = a.text.lower()
                if "transcript" in text:
                    quarter = "unknown"
                    match = re.search(r"(q[1-4])", text, re.IGNORECASE)
                    if match:
                        quarter = match.group(1).upper()
                    link = a["href"]
                    if not link.startswith("http"):
                        link = self.BASE_URL + link
                    docs["concalls"].append({"quarter": quarter, "link": link})
                    print(f"✅ Found concall transcript: {quarter} -> {link}")
        
        # 3. Credit Ratings
        ratings_section = soup.find("section", {"id": "credit-ratings"})
        if ratings_section:
            for a in ratings_section.find_all("a", href=True):
                link = a["href"]
                if not link.startswith("http"):
                    link = self.BASE_URL + link
                docs["credit_ratings"].append({"date": a.text.strip(), "link": link})
                print(f"✅ Found credit rating: {a.text.strip()} -> {link}")
        
        return docs
    
    def extract_peers(self, soup: BeautifulSoup) -> List[Dict]:
        """Extract peer comparison table."""
        section = soup.find("section", {"id": "peers"})
        if not section:
            return []
        table = section.find("table", {"class": "data-table"})
        if not table:
            return []
        headers = [th.text.strip() for th in table.find_all("th")]
        peers = []
        for tr in table.find_all("tr")[1:]:
            cells = tr.find_all("td")
            if not cells:
                continue
            peer = {}
            for i, cell in enumerate(cells):
                peer[headers[i]] = cell.text.strip()
            peers.append(peer)
        return peers
    
    def _insert_table_to_db(self, table_dict: Dict, table_name: str) -> Dict[str, Any]:
        """
        Insert table data directly to PostgreSQL and ChromaDB.
        
        Args:
            table_dict: Table data {'headers': [...], 'rows': {...}}
            table_name: 'quarterly_results', 'profit_loss', 'balance_sheet', 'cash_flow', 'ratios'
        
        Returns:
            {db_result: {inserted, skipped, errors}, chroma_result: {ok, count, ids}}
        """
        print(f"_insert_table_to_db: processing {table_name}")
        result = {"db_result": {}, "chroma_result": {}}
        
        # 1. Parse table to metrics records
        metrics_records = parse_table_to_metrics_records(
            table_dict, 
            table_name, 
            self.ticker, 
            self.url
        )
        
        # 2. Insert metrics to PostgreSQL if db_engine provided
        if self.db_engine and metrics_records:
            try:
                db_result = batch_insert_financial_metrics(self.db_engine, metrics_records)
                result["db_result"] = db_result
                print(f"✅ Inserted {db_result['inserted']} metrics to PostgreSQL")
            except Exception as e:
                print(f"❌ PostgreSQL insert error: {str(e)}")
                result["db_result"] = {"error": str(e)}
        
        # 3. Generate chunks and insert to ChromaDB if client provided
        if self.chroma_client and table_dict:
            try:
                chunks = generate_chunks_from_table(
                    table_dict, 
                    table_name, 
                    self.ticker, 
                    self.ticker, 
                    self.url
                )
                if chunks:
                    chroma_result = embed_text_chunks(chunks)
                    result["chroma_result"] = chroma_result
                    print(f"✅ Embedded {chroma_result['count']} chunks to ChromaDB")
            except Exception as e:
                print(f"❌ ChromaDB insert error: {str(e)}")
                result["chroma_result"] = {"error": str(e)}
        
        return result
    
    def scrape_all(self) -> Dict[str, Any]:
        """Run all extractors and return combined data, with direct DB insertion."""
        print(f"scrape_all: starting for {self.ticker}")
        soup = self.fetch_page()
        
        # Extract all tables
        quarterly_results = self.extract_quarterly_results(soup)
        profit_loss = self.extract_annual_financials(soup, "profit-loss")
        balance_sheet = self.extract_annual_financials(soup, "balance-sheet")
        cash_flow = self.extract_annual_financials(soup, "cash-flow")
        ratios = self.extract_annual_financials(soup, "ratios")
        
        # Insert tables to DB and ChromaDB
        print("Inserting tables to database...")
        quarterly_insert = self._insert_table_to_db(quarterly_results, "quarterly_results")
        profit_loss_insert = self._insert_table_to_db(profit_loss, "profit_loss")
        balance_sheet_insert = self._insert_table_to_db(balance_sheet, "balance_sheet")
        cash_flow_insert = self._insert_table_to_db(cash_flow, "cash_flow")
        ratios_insert = self._insert_table_to_db(ratios, "ratios")
        
        # Extract other data (non-tabular or categorical)
        shareholding = self.extract_shareholding(soup)
        pros_cons = self.extract_pros_cons(soup)
        documents = self.extract_document_links(soup)
        peers = self.extract_peers(soup)
        
        # Build final data structure
        data = {
            "ticker": self.ticker,
            "url": self.url,
            "quarterly_results": quarterly_results,
            "profit_loss": profit_loss,
            "balance_sheet": balance_sheet,
            "cash_flow": cash_flow,
            "ratios": ratios,
            "shareholding": shareholding,
            "pros_cons": pros_cons,
            "documents": documents,
            "peers": peers,
            "db_insertion_results": {
                "quarterly_results": quarterly_insert,
                "profit_loss": profit_loss_insert,
                "balance_sheet": balance_sheet_insert,
                "cash_flow": cash_flow_insert,
                "ratios": ratios_insert,
            }
        }
        
        print(f"scrape_all: end (success)")
        return data
