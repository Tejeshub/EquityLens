from urllib.parse import urljoin
import requests
from bs4 import BeautifulSoup
from config import USER_AGENT

def find_pdf_links(page_url: str) -> dict:
    print(f"find_pdf_links: start for {page_url}")
    try:
        headers = {"User-Agent": USER_AGENT}
        print(f"find_pdf_links: fetching page")
        r = requests.get(page_url, headers=headers, timeout=30)
        r.raise_for_status()
        print(f"find_pdf_links: page fetched, parsing HTML")
        soup = BeautifulSoup(r.text, "html.parser")
        pdf_links = []
        for a in soup.find_all("a", href=True):
            href = urljoin(page_url, a["href"])
            label = a.get_text(" ", strip=True)
            if ".pdf" in href.lower() or any(k in label.lower() for k in ["annual report", "presentation", "transcript", "results"]):
                print(f"find_pdf_links: found PDF link {href}")
                pdf_links.append({"label": label, "pdf_url": href})
        print(f"find_pdf_links: end (success) - found {len(pdf_links)} PDFs")
        return {"ok": True, "page_url": page_url, "pdf_links": pdf_links}
    except Exception as e:
        print(f"find_pdf_links: ERROR - {type(e).__name__}: {str(e)}")
        raise