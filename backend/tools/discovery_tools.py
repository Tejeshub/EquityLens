from urllib.parse import urljoin
import requests
from bs4 import BeautifulSoup
from agno.tools import tool
from config import USER_AGENT

@tool
def find_pdf_links(page_url: str) -> dict:
    headers = {"User-Agent": USER_AGENT}
    r = requests.get(page_url, headers=headers, timeout=30)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "html.parser")
    pdf_links = []
    for a in soup.find_all("a", href=True):
        href = urljoin(page_url, a["href"])
        label = a.get_text(" ", strip=True)
        if ".pdf" in href.lower() or any(k in label.lower() for k in ["annual report", "presentation", "transcript", "results"]):
            pdf_links.append({"label": label, "pdf_url": href})
    return {"ok": True, "page_url": page_url, "pdf_links": pdf_links}