/* The Olive Grove Project — wallet, live on-chain counter, grove wall, copy buttons */
(function () {
  var WALLET = {
    address: "TK5UxcvuY57FvcQbsqYqxKxkBvQwrmaDQm",
    network: "TRON (TRC-20)",
    usdtContract: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
    goal: 5000,
    seedling: 10
  };
  var TRONSCAN_ADDR = "https://tronscan.org/#/address/" + WALLET.address;
  var TRONGRID = "https://api.trongrid.io/v1";
  window.GROVE_WALLET = WALLET;
  window.GROVE_TRONSCAN = TRONSCAN_ADDR;

  function fmt(n) {
    if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
    return (Math.round(n * 100) / 100).toString();
  }

  /* ---- fetch incoming USDT (TRC-20) transfers, newest first ---- */
  async function fetchIncoming() {
    var url = TRONGRID + "/accounts/" + WALLET.address +
      "/transactions/trc20?only_to=true&limit=100&contract_address=" + WALLET.usdtContract;
    var txs = [], total = 0, pages = 0;
    while (url && pages < 3) {
      var ctrl = new AbortController();
      var t = setTimeout(function () { ctrl.abort(); }, 12000);
      var r = await fetch(url, { signal: ctrl.signal });
      clearTimeout(t);
      var j = await r.json();
      var data = j.data || [];
      for (var i = 0; i < data.length; i++) {
        var x = data[i];
        var ti = x.token_info || x.tokenInfo || {};
        if (x.to !== WALLET.address) continue;
        if (ti.address && ti.address !== WALLET.usdtContract) continue;
        var dec = Number(ti.decimals || 6);
        var v = Number(x.value) / Math.pow(10, dec);
        if (!(v > 0)) continue;
        total += v;
        txs.push({ id: x.transaction_id, from: x.from, v: v, ts: x.block_timestamp });
      }
      pages++;
      var next = (j.meta && j.meta.links && j.meta.links.next) ? j.meta.links.next : null;
      if (!next || data.length < 100) break;
      url = next;
    }
    txs.sort(function (a, b) { return b.ts - a.ts; });
    return { total: total, txs: txs };
  }

  function when(ts) {
    var d = new Date(ts);
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  }
  function short(a) { return a.slice(0, 6) + "…" + a.slice(-6); }

  document.addEventListener("DOMContentLoaded", async function () {
    /* copy buttons */
    document.querySelectorAll("[data-copy]").forEach(function (b) {
      b.addEventListener("click", function () {
        var txt = b.getAttribute("data-copy");
        function done() {
          var old = b.textContent;
          b.textContent = "Copied ✓";
          setTimeout(function () { b.textContent = old; }, 1600);
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(txt).then(done).catch(function () { legacy(); });
        } else { legacy(); }
        function legacy() {
          var ta = document.createElement("textarea");
          ta.value = txt; document.body.appendChild(ta); ta.select();
          try { document.execCommand("copy"); done(); } catch (e) { }
          document.body.removeChild(ta);
        }
      });
    });

    var hasStats = document.getElementById("grove-raised");
    var hasWall = document.getElementById("grove-wall");
    if (!hasStats && !hasWall) return;

    var fill = document.querySelectorAll("[data-wallet]"), i;
    for (i = 0; i < fill.length; i++) fill[i].textContent = WALLET.address;
    var link = document.querySelectorAll("[data-tronscan]");
    for (i = 0; i < link.length; i++) link[i].href = TRONSCAN_ADDR;

    try {
      var res = await fetchIncoming();
      if (hasStats) {
        var raisedEl = document.getElementById("grove-raised");
        var treesEl = document.getElementById("grove-trees");
        var barEl = document.getElementById("grove-bar");
        var pctEl = document.getElementById("grove-pct");
        raisedEl.textContent = fmt(res.total) + " USDT";
        treesEl.textContent = Math.floor(res.total / WALLET.seedling).toString();
        if (barEl) barEl.style.width = Math.min(100, (res.total / WALLET.goal) * 100) + "%";
        if (pctEl) pctEl.textContent = Math.min(100, Math.round((res.total / WALLET.goal) * 100)) + "% of the $5,000 first-grove goal";
      }
      if (hasWall) {
        var wall = document.getElementById("grove-wall");
        if (!res.txs.length) {
          wall.innerHTML = '<div class="grove-entry"><span class="seed">🌱</span><div><b>The grove is waiting for its first tree.</b><div class="small-note">No on-chain donation has arrived yet — the wall fills itself the moment the first USDT transfer lands. <a href="/">Plant the first tree →</a></div></div></div>';
        } else {
          wall.innerHTML = res.txs.map(function (x) {
            var trees = x.v / WALLET.seedling;
            var treesTxt = trees >= 1 ? Math.floor(trees) + " tree" + (Math.floor(trees) > 1 ? "s" : "") + " funded" : "seedling fund contribution";
            return '<div class="grove-entry"><span class="seed">🫒</span>' +
              '<div><div class="who" title="' + x.from + '">from ' + short(x.from) + ' · ' + when(x.ts) + '</div>' +
              '<div class="trees">' + treesTxt + ' · <a href="https://tronscan.org/#/transaction/' + x.id + '" target="_blank" rel="noopener">receipt on Tronscan ↗</a></div></div>' +
              '<div class="amt">' + fmt(x.v) + ' USDT</div></div>';
          }).join("");
        }
      }
    } catch (e) {
      if (hasStats) {
        var r2 = document.getElementById("grove-raised");
        if (r2) r2.textContent = "— live";
        var note = document.getElementById("grove-note");
        if (note) note.textContent = "The live total could not load just now — see every transfer directly on Tronscan.";
      }
      if (hasWall) {
        document.getElementById("grove-wall").innerHTML =
          '<div class="grove-entry"><span class="seed">🫒</span><div><b>The live wall is momentarily unavailable.</b><div class="small-note">Every transfer is always visible on <a href="' + TRONSCAN_ADDR + '" target="_blank" rel="noopener">Tronscan ↗</a></div></div></div>';
      }
    }
  });
})();
