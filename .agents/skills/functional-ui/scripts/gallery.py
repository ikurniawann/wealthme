#!/usr/bin/env python3
"""Render HTML mocks in a row; each expands to fullscreen.
Usage: python3 gallery.py a.html b.html c.html [--open]
"""
import sys, os, html, webbrowser

paths = [p for p in sys.argv[1:] if not p.startswith("--")]
do_open = "--open" in sys.argv
if not paths:
    sys.exit("usage: gallery.py file1.html file2.html ... [--open]")

cards = ""
for i, p in enumerate(paths):
    src = "file://" + os.path.abspath(p)
    label = html.escape(os.path.basename(p))
    cards += f'''
    <div class="card">
      <div class="bar"><span>{label}</span>
        <button onclick="expand('{src}','{label}')">⤢ expand</button></div>
      <iframe src="{src}" loading="lazy"></iframe>
    </div>'''

doc = f'''<!doctype html><meta charset="utf-8"><title>mock gallery</title>
<style>
  *{{box-sizing:border-box}}
  body{{margin:0;font:13px ui-monospace,monospace;background:#0d0d0f;color:#ddd}}
  h1{{font-size:14px;margin:0;padding:12px 16px;background:#16161a;border-bottom:1px solid #2a2a30}}
  .row{{display:grid;grid-template-columns:repeat({len(paths)},1fr);gap:14px;padding:14px}}
  .card{{background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.4)}}
  .bar{{display:flex;justify-content:space-between;align-items:center;padding:6px 10px;background:#16161a;color:#aaa}}
  .bar button{{background:#2a2a30;color:#cde;border:0;border-radius:5px;padding:4px 9px;cursor:pointer;font:inherit}}
  .bar button:hover{{background:#3a3a44}}
  .card iframe{{width:100%;height:70vh;border:0;background:#fff;display:block}}
  #ov{{position:fixed;inset:0;background:rgba(0,0,0,.85);display:none;flex-direction:column;z-index:99}}
  #ov.on{{display:flex}}
  #ov .obar{{display:flex;justify-content:space-between;align-items:center;padding:10px 16px;background:#16161a}}
  #ov .obar button{{background:#2a2a30;color:#cde;border:0;border-radius:5px;padding:6px 12px;cursor:pointer;font:inherit}}
  #ov iframe{{flex:1;width:100%;border:0;background:#fff}}
</style>
<h1>mock gallery — {len(paths)} variants</h1>
<div class="row">{cards}</div>
<div id="ov">
  <div class="obar"><span id="ovl"></span><button onclick="close_()">✕ close</button></div>
  <iframe id="ovf"></iframe>
</div>
<script>
  const ov=document.getElementById('ov'),ovf=document.getElementById('ovf'),ovl=document.getElementById('ovl');
  function expand(src,label){{ovf.src=src;ovl.textContent=label;ov.classList.add('on');}}
  function close_(){{ov.classList.remove('on');ovf.src='about:blank';}}
  document.onkeydown=e=>{{if(e.key==='Escape')close_();}};
</script>'''

out = os.path.abspath("gallery.html")
open(out,"w").write(doc)
print("wrote", out)
if do_open: webbrowser.open("file://"+out)
