import re, time
from playwright.sync_api import sync_playwright

BASE = "https://v0-noblestride-website-wireframe.vercel.app"
OUT = "/Users/devashishthapliyal/Documents/work/Lua/NOBLESTRIDE/context-screens"

def slug(url):
    p = url.replace(BASE, "").strip("/")
    return p.replace("/", "_") if p else "home"

with sync_playwright() as pw:
    browser = pw.chromium.launch()
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    page.goto(BASE, wait_until="networkidle", timeout=60000)
    time.sleep(2)

    # collect same-origin links
    hrefs = page.eval_on_selector_all(
        "a[href]", "els => els.map(e => e.getAttribute('href'))"
    )
    routes = set([""])
    for h in hrefs:
        if not h: continue
        if h.startswith("http") and BASE not in h: continue
        if h.startswith("#") or h.startswith("mailto") or h.startswith("tel"): continue
        path = h.replace(BASE, "")
        if path.startswith("/"):
            routes.add(path.strip("/"))
    print("Discovered routes:", sorted(routes))

    visited = []
    for r in sorted(routes):
        url = BASE + "/" + r if r else BASE
        try:
            page.goto(url, wait_until="networkidle", timeout=45000)
            time.sleep(1.5)
            fn = f"{OUT}/{slug(url)}.png"
            page.screenshot(path=fn, full_page=True)
            print("OK", url, "->", fn)
            visited.append((url, fn))
        except Exception as e:
            print("FAIL", url, repr(e)[:120])
    browser.close()
    print("TOTAL pages captured:", len(visited))
