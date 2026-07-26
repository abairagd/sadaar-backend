import React, { useState, useEffect, useMemo, useCallback } from "react";
import { ShoppingBag, Search, Plus, Minus, ChevronLeft, Menu, Check, Loader2 } from "lucide-react";

const API_BASE = "https://sadaar-backend-production.up.railway.app/api";

const C = {
  ink: "#16261C",
  deep: "#1E3324",
  sand: "#F3ECDD",
  warm: "#FBF8F1",
  bronze: "#B08D57",
  char: "#22201B",
  line: "#DCD2BB",
  muted: "#7A7566",
};

const FONTS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,500&family=Inter:wght@400;500;600&display=swap');
`;

const CATEGORIES = ["Contemporary", "Abayas", "Streetwear", "Accessories", "Footwear"];

const catTone = {
  Contemporary: { bg: C.sand, fg: C.ink },
  Abayas: { bg: "#EDE3D0", fg: C.deep },
  Streetwear: { bg: "#E7E1D2", fg: C.char },
  Accessories: { bg: "#EFE7D6", fg: C.bronze },
  Footwear: { bg: "#E4E6DD", fg: C.ink },
};

function money(n) {
  return `SAR ${Number(n).toLocaleString()}`;
}

async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function Tag({ text }) {
  return (
    <div style={{ position: "absolute", top: 14, left: -6, transform: "rotate(-6deg)", background: C.warm, border: `1px solid ${C.line}`, padding: "4px 10px 4px 16px", fontFamily: "Inter, sans-serif", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: C.ink, boxShadow: "1px 2px 4px rgba(22,38,28,0.12)", zIndex: 2 }}>
      <span style={{ position: "absolute", left: 5, top: "50%", width: 5, height: 5, borderRadius: "50%", background: C.warm, border: `1px solid ${C.muted}`, transform: "translateY(-50%)" }} />
      {text}
    </div>
  );
}

function Swatch({ product, height = 260 }) {
  const tone = catTone[product.category] || catTone.Contemporary;
  const brandName = product.brand_name || product.brandName || "SADAAR";
  return (
    <div style={{ position: "relative", height, background: tone.bg, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ fontFamily: "Fraunces, serif", fontStyle: "italic", fontWeight: 500, fontSize: height * 0.62, color: tone.fg, opacity: 0.16, lineHeight: 1 }}>
        {brandName.charAt(0)}
      </span>
      <Tag text={brandName} />
    </div>
  );
}

function ProductCard({ product, onOpen }) {
  return (
    <button onClick={() => onOpen(product.id)} style={{ textAlign: "left", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "Inter, sans-serif" }}>
      <Swatch product={product} />
      <div style={{ paddingTop: 10 }}>
        <p style={{ margin: 0, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: C.muted }}>{product.brand_name}</p>
        <p style={{ margin: "2px 0 0", fontSize: 15, color: C.char, fontFamily: "Fraunces, serif" }}>{product.name}</p>
        <p style={{ margin: "4px 0 0", fontSize: 14, color: C.ink, fontWeight: 500 }}>{money(product.price)}</p>
      </div>
    </button>
  );
}

function Loading({ label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: 40, fontFamily: "Inter, sans-serif", fontSize: 13, color: C.muted }}>
      <Loader2 size={16} className="spin" style={{ animation: "spin 1s linear infinite" }} />
      {label || "Loading..."}
      <style>{`@keyframes spin { from { transform: rotate(0deg);} to { transform: rotate(360deg);} }`}</style>
    </div>
  );
}

function ErrorBox({ message }) {
  return (
    <div style={{ padding: 40, fontFamily: "Inter, sans-serif", fontSize: 13, color: "#A3402F" }}>
      Couldn't reach SADAAR right now — {message}. The API may be waking up; try refreshing in a moment.
    </div>
  );
}

function Header({ setView, cartCount, onSearchClick }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <header style={{ position: "sticky", top: 0, zIndex: 20, background: C.warm, borderBottom: `1px solid ${C.line}` }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <button onClick={() => setMenuOpen((m) => !m)} style={{ background: "none", border: "none", cursor: "pointer" }} aria-label="Menu">
          <Menu size={20} color={C.ink} />
        </button>
        <button onClick={() => setView({ type: "home" })} style={{ background: "none", border: "none", cursor: "pointer", textAlign: "center" }}>
          <div style={{ fontFamily: "Fraunces, serif", fontWeight: 600, fontSize: 26, letterSpacing: "0.04em", color: C.ink }}>SADAAR</div>
          <div style={{ fontFamily: "Inter, sans-serif", fontSize: 9.5, letterSpacing: "0.18em", textTransform: "uppercase", color: C.bronze, marginTop: -2 }}>Home of Saudi Fashion</div>
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <button onClick={onSearchClick} style={{ background: "none", border: "none", cursor: "pointer" }} aria-label="Search"><Search size={19} color={C.ink} /></button>
          <button onClick={() => setView({ type: "cart" })} style={{ background: "none", border: "none", cursor: "pointer", position: "relative" }} aria-label="Cart">
            <ShoppingBag size={19} color={C.ink} />
            {cartCount > 0 && (
              <span style={{ position: "absolute", top: -6, right: -8, background: C.ink, color: C.warm, fontSize: 10, width: 16, height: 16, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>{cartCount}</span>
            )}
          </button>
        </div>
      </div>
      {menuOpen && (
        <div style={{ borderTop: `1px solid ${C.line}`, padding: "14px 24px 18px", display: "flex", flexWrap: "wrap", gap: "10px 22px", fontFamily: "Inter, sans-serif", fontSize: 14 }}>
          <button onClick={() => { setView({ type: "home" }); setMenuOpen(false); }} style={navBtn}>Home</button>
          <button onClick={() => { setView({ type: "browse" }); setMenuOpen(false); }} style={navBtn}>Shop all</button>
          {CATEGORIES.map((c) => (
            <button key={c} onClick={() => { setView({ type: "browse", cat: c }); setMenuOpen(false); }} style={navBtn}>{c}</button>
          ))}
          <button onClick={() => { setView({ type: "brands" }); setMenuOpen(false); }} style={navBtn}>Brands</button>
        </div>
      )}
    </header>
  );
}

const navBtn = { background: "none", border: "none", cursor: "pointer", color: C.char, padding: "4px 0" };

function Footer() {
  return (
    <footer style={{ background: C.ink, color: C.sand, marginTop: 64 }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "48px 24px", display: "flex", flexWrap: "wrap", gap: 40, justifyContent: "space-between" }}>
        <div style={{ maxWidth: 320 }}>
          <div style={{ fontFamily: "Fraunces, serif", fontSize: 22, marginBottom: 8 }}>SADAAR</div>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, lineHeight: 1.6, color: "#C9CDBF" }}>One marketplace for Saudi fashion — every brand kept true to its own hand, delivered through one trusted checkout.</p>
        </div>
        <div style={{ fontFamily: "Inter, sans-serif", fontSize: 13, lineHeight: 2, color: "#C9CDBF" }}>
          <div style={{ color: C.sand, marginBottom: 6, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase" }}>Shop</div>
          {CATEGORIES.map((c) => <div key={c}>{c}</div>)}
        </div>
      </div>
      <div style={{ borderTop: "1px solid #2C3D30", padding: "16px 24px", fontFamily: "Inter, sans-serif", fontSize: 12, color: "#8C9186", textAlign: "center" }}>© 2026 SADAAR. Every product ships direct from its brand.</div>
    </footer>
  );
}

function Home({ setView, openProduct, products, brands, loading, error }) {
  const featured = products.slice(0, 8);
  return (
    <div>
      <section style={{ maxWidth: 1180, margin: "0 auto", padding: "56px 24px 40px", display: "flex", flexWrap: "wrap", gap: 40, alignItems: "center" }}>
        <div style={{ flex: "1 1 380px" }}>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: C.bronze, marginBottom: 14 }}>Curated · Direct from the brand</p>
          <h1 style={{ fontFamily: "Fraunces, serif", fontWeight: 500, fontSize: "clamp(34px, 5vw, 56px)", lineHeight: 1.05, color: C.ink, margin: 0 }}>The home of<br />Saudi fashion.</h1>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: 15, color: C.muted, marginTop: 20, maxWidth: 420, lineHeight: 1.6 }}>Independent Saudi labels, one checkout. Every piece is shipped and stood behind by the brand that made it.</p>
          <button onClick={() => setView({ type: "browse" })} style={{ marginTop: 28, background: C.ink, color: C.warm, border: "none", padding: "13px 28px", fontFamily: "Inter, sans-serif", fontSize: 14, cursor: "pointer" }}>Shop the edit</button>
        </div>
        <div style={{ flex: "1 1 340px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {featured.slice(0, 4).map((p, i) => (
            <div key={p.id} style={{ marginTop: i % 2 === 0 ? 30 : 0 }}><Swatch product={p} height={i === 1 ? 260 : 200} /></div>
          ))}
        </div>
      </section>

      {loading && <Loading label="Loading brands and products from SADAAR..." />}
      {error && <ErrorBox message={error} />}

      {!loading && !error && (
        <>
          <section style={{ maxWidth: 1180, margin: "0 auto", padding: "24px 24px 8px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 18 }}>
              <h2 style={{ fontFamily: "Fraunces, serif", fontSize: 22, color: C.ink, margin: 0 }}>Curated brands</h2>
              <button onClick={() => setView({ type: "brands" })} style={{ background: "none", border: "none", fontFamily: "Inter, sans-serif", fontSize: 13, color: C.bronze, cursor: "pointer" }}>View all →</button>
            </div>
            <div style={{ display: "flex", gap: 16, overflowX: "auto", paddingBottom: 8 }}>
              {brands.map((b) => (
                <div key={b.id} style={{ minWidth: 220, border: `1px solid ${C.line}`, padding: 18, background: C.warm }}>
                  <p style={{ margin: 0, fontFamily: "Fraunces, serif", fontSize: 17, color: C.ink }}>{b.name}</p>
                  <p style={{ margin: "4px 0 0", fontFamily: "Inter, sans-serif", fontSize: 12, color: C.muted }}>{b.description}</p>
                </div>
              ))}
            </div>
          </section>

          <section style={{ maxWidth: 1180, margin: "0 auto", padding: "48px 24px 8px" }}>
            <h2 style={{ fontFamily: "Fraunces, serif", fontSize: 22, color: C.ink, marginBottom: 18 }}>Shop by category</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14 }}>
              {CATEGORIES.map((c) => {
                const tone = catTone[c];
                return (
                  <button key={c} onClick={() => setView({ type: "browse", cat: c })} style={{ background: tone.bg, border: "none", padding: "34px 18px", cursor: "pointer", fontFamily: "Fraunces, serif", fontSize: 17, color: tone.fg, textAlign: "left" }}>{c}</button>
                );
              })}
            </div>
          </section>

          <section style={{ maxWidth: 1180, margin: "0 auto", padding: "48px 24px 8px" }}>
            <h2 style={{ fontFamily: "Fraunces, serif", fontSize: 22, color: C.ink, marginBottom: 18 }}>This week's edit</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "28px 20px" }}>
              {featured.map((p) => <ProductCard key={p.id} product={p} onOpen={openProduct} />)}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Browse({ initialCat, openProduct, brands }) {
  const [cat, setCat] = useState(initialCat || "all");
  const [brand, setBrand] = useState("all");
  const [sort, setSort] = useState("featured");
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (cat !== "all") params.set("category", cat);
    if (brand !== "all") params.set("brandId", brand);
    if (sort !== "featured") params.set("sort", sort);
    api(`/products?${params.toString()}`)
      .then(setProducts)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [cat, brand, sort]);

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "32px 24px 64px", display: "flex", gap: 32 }}>
      <aside style={{ width: 200, flexShrink: 0 }}>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: C.muted, marginBottom: 10 }}>Category</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 24 }}>
          {["all", ...CATEGORIES].map((c) => (
            <button key={c} onClick={() => setCat(c)} style={{ textAlign: "left", background: "none", border: "none", cursor: "pointer", fontFamily: "Inter, sans-serif", fontSize: 14, color: cat === c ? C.ink : C.muted, fontWeight: cat === c ? 600 : 400 }}>{c === "all" ? "All" : c}</button>
          ))}
        </div>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: C.muted, marginBottom: 10 }}>Brand</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {[{ id: "all", name: "All" }, ...brands].map((b) => (
            <button key={b.id} onClick={() => setBrand(String(b.id))} style={{ textAlign: "left", background: "none", border: "none", cursor: "pointer", fontFamily: "Inter, sans-serif", fontSize: 14, color: brand === String(b.id) ? C.ink : C.muted, fontWeight: brand === String(b.id) ? 600 : 400 }}>{b.name}</button>
          ))}
        </div>
      </aside>

      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: C.muted }}>{loading ? "..." : `${products.length} pieces`}</p>
          <select value={sort} onChange={(e) => setSort(e.target.value)} style={{ fontFamily: "Inter, sans-serif", fontSize: 13, border: `1px solid ${C.line}`, padding: "6px 10px", background: C.warm, color: C.char }}>
            <option value="featured">Featured</option>
            <option value="price-asc">Price: low to high</option>
            <option value="price-desc">Price: high to low</option>
          </select>
        </div>
        {loading && <Loading />}
        {error && <ErrorBox message={error} />}
        {!loading && !error && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "28px 20px" }}>
            {products.map((p) => <ProductCard key={p.id} product={p} onOpen={openProduct} />)}
          </div>
        )}
        {!loading && !error && products.length === 0 && <p style={{ fontFamily: "Inter, sans-serif", color: C.muted }}>No pieces match that filter yet.</p>}
      </div>
    </div>
  );
}

function ProductDetail({ productId, onBack, onAddToCart }) {
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [variantId, setVariantId] = useState(null);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    setLoading(true);
    api(`/products/${productId}`)
      .then((p) => { setProduct(p); setVariantId(p.variants?.[0]?.id ?? null); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [productId]);

  if (loading) return <div style={{ maxWidth: 1180, margin: "0 auto", padding: "28px 24px" }}><Loading /></div>;
  if (error) return <div style={{ maxWidth: 1180, margin: "0 auto", padding: "28px 24px" }}><ErrorBox message={error} /></div>;
  if (!product) return null;

  const variant = product.variants.find((v) => v.id === variantId);

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "28px 24px 64px" }}>
      <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "Inter, sans-serif", fontSize: 13, color: C.muted, marginBottom: 20 }}><ChevronLeft size={16} /> Back</button>
      <div style={{ display: "flex", gap: 48, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 380px" }}><Swatch product={product} height={460} /></div>
        <div style={{ flex: "1 1 320px" }}>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: C.bronze }}>{product.brand_name}</p>
          <h1 style={{ fontFamily: "Fraunces, serif", fontWeight: 500, fontSize: 30, color: C.ink, margin: "6px 0" }}>{product.name}</h1>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: 18, color: C.char, marginBottom: 20 }}>{money(product.price)}</p>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: 14, color: C.muted, lineHeight: 1.6, marginBottom: 24 }}>{product.description}</p>

          <p style={{ fontFamily: "Inter, sans-serif", fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase", color: C.muted, marginBottom: 8 }}>Size</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 22 }}>
            {product.variants.map((v) => (
              <button key={v.id} disabled={v.stock_qty === 0} onClick={() => setVariantId(v.id)} style={{ padding: "8px 14px", border: `1px solid ${variantId === v.id ? C.ink : C.line}`, background: variantId === v.id ? C.ink : "none", color: v.stock_qty === 0 ? C.line : variantId === v.id ? C.warm : C.char, fontFamily: "Inter, sans-serif", fontSize: 13, cursor: v.stock_qty === 0 ? "not-allowed" : "pointer" }}>
                {v.size}{v.stock_qty === 0 ? " (sold out)" : ""}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 22 }}>
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase", color: C.muted, margin: 0 }}>Qty</p>
            <div style={{ display: "flex", alignItems: "center", border: `1px solid ${C.line}` }}>
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} style={{ background: "none", border: "none", padding: "6px 10px", cursor: "pointer" }}><Minus size={14} /></button>
              <span style={{ padding: "0 10px", fontFamily: "Inter, sans-serif", fontSize: 14 }}>{qty}</span>
              <button onClick={() => setQty((q) => q + 1)} style={{ background: "none", border: "none", padding: "6px 10px", cursor: "pointer" }}><Plus size={14} /></button>
            </div>
          </div>

          <button
            disabled={!variant || variant.stock_qty === 0}
            onClick={() => { onAddToCart(product, variant, qty); setAdded(true); setTimeout(() => setAdded(false), 1600); }}
            style={{ width: "100%", background: !variant || variant.stock_qty === 0 ? C.line : C.ink, color: C.warm, border: "none", padding: "14px 0", fontFamily: "Inter, sans-serif", fontSize: 14, cursor: !variant || variant.stock_qty === 0 ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
          >
            {added ? <><Check size={16} /> Added to cart</> : variant?.stock_qty === 0 ? "Sold out" : "Add to cart"}
          </button>

          <p style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: C.muted, marginTop: 16, borderTop: `1px solid ${C.line}`, paddingTop: 16 }}>Shipped directly by {product.brand_name}, curated and guaranteed by SADAAR.</p>
        </div>
      </div>
    </div>
  );
}

function Cart({ items, updateQty, removeItem, setView }) {
  const subtotal = items.reduce((s, i) => s + i.product.price * i.qty, 0);
  if (items.length === 0) {
    return (
      <div style={{ maxWidth: 700, margin: "0 auto", padding: "80px 24px", textAlign: "center" }}>
        <ShoppingBag size={32} color={C.line} style={{ marginBottom: 16 }} />
        <p style={{ fontFamily: "Fraunces, serif", fontSize: 22, color: C.ink }}>Your bag is empty</p>
        <button onClick={() => setView({ type: "browse" })} style={{ marginTop: 16, background: C.ink, color: C.warm, border: "none", padding: "12px 24px", fontFamily: "Inter, sans-serif", fontSize: 14, cursor: "pointer" }}>Shop the edit</button>
      </div>
    );
  }
  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px 64px" }}>
      <h1 style={{ fontFamily: "Fraunces, serif", fontSize: 26, color: C.ink, marginBottom: 24 }}>Your bag</h1>
      {items.map((item, idx) => (
        <div key={idx} style={{ display: "flex", gap: 18, padding: "18px 0", borderBottom: `1px solid ${C.line}` }}>
          <div style={{ width: 100, flexShrink: 0 }}><Swatch product={item.product} height={120} /></div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontFamily: "Inter, sans-serif", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: C.muted }}>{item.product.brand_name}</p>
            <p style={{ margin: "4px 0", fontFamily: "Fraunces, serif", fontSize: 16, color: C.ink }}>{item.product.name}</p>
            <p style={{ margin: 0, fontFamily: "Inter, sans-serif", fontSize: 13, color: C.muted }}>Size {item.variant.size}</p>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
              <div style={{ display: "flex", alignItems: "center", border: `1px solid ${C.line}` }}>
                <button onClick={() => updateQty(idx, -1)} style={{ background: "none", border: "none", padding: "4px 8px", cursor: "pointer" }}><Minus size={12} /></button>
                <span style={{ padding: "0 8px", fontSize: 13, fontFamily: "Inter, sans-serif" }}>{item.qty}</span>
                <button onClick={() => updateQty(idx, 1)} style={{ background: "none", border: "none", padding: "4px 8px", cursor: "pointer" }}><Plus size={12} /></button>
              </div>
              <button onClick={() => removeItem(idx)} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, fontFamily: "Inter, sans-serif", fontSize: 12, textDecoration: "underline" }}>Remove</button>
            </div>
          </div>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: 14, color: C.ink, fontWeight: 500 }}>{money(item.product.price * item.qty)}</p>
        </div>
      ))}
      <div style={{ display: "flex", justifyContent: "space-between", padding: "20px 0", fontFamily: "Inter, sans-serif" }}>
        <p style={{ fontSize: 15, color: C.char }}>Subtotal</p>
        <p style={{ fontSize: 15, color: C.ink, fontWeight: 600 }}>{money(subtotal)}</p>
      </div>
      <button onClick={() => setView({ type: "checkout" })} style={{ width: "100%", background: C.ink, color: C.warm, border: "none", padding: "15px 0", fontFamily: "Inter, sans-serif", fontSize: 14, cursor: "pointer" }}>Checkout</button>
    </div>
  );
}

function Checkout({ items, setView, clearCart }) {
  const subtotal = items.reduce((s, i) => s + i.product.price * i.qty, 0);
  const [form, setForm] = useState({ fullName: "", email: "", phone: "", city: "", address: "" });
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState(null);
  const [order, setOrder] = useState(null); // set once the (unpaid) order is created
  const [paid, setPaid] = useState(false);
  const [publishableKey, setPublishableKey] = useState(null);
  const formRef = React.useRef(null);

  useEffect(() => {
    api("/config/moyasar").then((c) => setPublishableKey(c.publishableKey)).catch(() => {});
  }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const placeOrder = async () => {
    if (!form.fullName || !form.phone || !form.city || !form.address) {
      setError("Please fill in all fields.");
      return;
    }
    setPlacing(true);
    setError(null);
    try {
      const result = await api("/orders", {
        method: "POST",
        body: JSON.stringify({
          customer: form,
          items: items.map((i) => ({ variantId: i.variant.id, quantity: i.qty })),
        }),
      });
      setOrder(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setPlacing(false);
    }
  };

  const [debugMsg, setDebugMsg] = useState("");

  // Once we have an unpaid order and Moyasar's key, mount their hosted card form.
  useEffect(() => {
    if (!order || !publishableKey || paid) return;
    setDebugMsg("Loading payment form script...");

    // 3D Secure does a full page redirect + reload, wiping React state. Save what
    // we need to sessionStorage so the app can pick up where it left off after
    // the redirect back (see the top-level check in SadaarMarketplace below).
    sessionStorage.setItem("sadaar_pending_order", JSON.stringify({ orderId: order.orderId, total: order.total }));

    const existing = document.querySelector('script[src*="moyasar.js"]');
    const mount = () => {
      try {
        if (!document.querySelector(".mysr-form")) {
          setDebugMsg("Error: .mysr-form element not found in page yet.");
          return;
        }
        if (!window.Moyasar) {
          setDebugMsg("Error: Moyasar script loaded but window.Moyasar is undefined.");
          return;
        }
        window.Moyasar.init({
          element: ".mysr-form",
          amount: Math.round(order.total * 100),
          currency: "SAR",
          description: `SADAAR order #${order.orderId}`,
          publishable_api_key: publishableKey,
          callback_url: window.location.origin + window.location.pathname,
          methods: ["creditcard"],
          metadata: { orderId: String(order.orderId) },
          on_completed: async (payment) => {
            try {
              await api(`/orders/${order.orderId}/confirm-payment`, {
                method: "POST",
                body: JSON.stringify({ paymentId: payment.id }),
              });
              setPaid(true);
              clearCart();
            } catch (e) {
              setError(e.message);
            }
          },
        });
        setDebugMsg("");
      } catch (err) {
        setDebugMsg(`Error initializing payment form: ${err.name}: ${err.message}`);
      }
    };

    if (existing && window.Moyasar) {
      mount();
      return;
    }

    const linkEl = document.createElement("link");
    linkEl.rel = "stylesheet";
    linkEl.href = "https://cdn.moyasar.com/mpf/1.7.3/moyasar.css";
    document.head.appendChild(linkEl);

    const script = document.createElement("script");
    script.src = "https://cdn.moyasar.com/mpf/1.7.3/moyasar.js";
    script.onload = () => { setDebugMsg("Script loaded, initializing form..."); mount(); };
    script.onerror = () => setDebugMsg("Error: failed to load moyasar.js from CDN (network/blocked?).");
    document.body.appendChild(script);
  }, [order, publishableKey, paid]);

  if (paid) {
    return (
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "80px 24px", textAlign: "center" }}>
        <Check size={30} color={C.ink} style={{ marginBottom: 16 }} />
        <h1 style={{ fontFamily: "Fraunces, serif", fontSize: 26, color: C.ink, marginBottom: 8 }}>Payment received</h1>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: 14, color: C.muted, marginBottom: 4 }}>Order #{order.orderId} — {money(order.total)}</p>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: C.muted, marginBottom: 24 }}>Each brand in your bag has been notified to fulfill their item.</p>
        <button onClick={() => setView({ type: "home" })} style={{ background: C.ink, color: C.warm, border: "none", padding: "12px 24px", fontFamily: "Inter, sans-serif", fontSize: 14, cursor: "pointer" }}>Back to SADAAR</button>
      </div>
    );
  }

  // Order exists (unpaid) — show the real card form.
  if (order) {
    return (
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "32px 24px 64px" }}>
        <h1 style={{ fontFamily: "Fraunces, serif", fontSize: 24, color: C.ink, marginBottom: 6 }}>Payment</h1>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: C.muted, marginBottom: 20 }}>Order #{order.orderId} — {money(order.total)}</p>
        {!publishableKey && <ErrorBox message="payment gateway isn't configured yet on the backend (MOYASAR_PUBLISHABLE_KEY missing)" />}
        {error && <p style={{ color: "#A3402F", fontFamily: "Inter, sans-serif", fontSize: 13, marginBottom: 12 }}>{error}</p>}
        {debugMsg && <p style={{ color: C.muted, fontFamily: "monospace", fontSize: 11, marginBottom: 12, whiteSpace: "pre-wrap" }}>{debugMsg}</p>}
        <div className="mysr-form" ref={formRef} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "32px 24px 64px" }}>
      <h1 style={{ fontFamily: "Fraunces, serif", fontSize: 24, color: C.ink, marginBottom: 6 }}>Checkout</h1>
      <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: C.muted, marginBottom: 24 }}>Enter your shipping details, then you'll pay by card on the next step.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
        <input placeholder="Full name" value={form.fullName} onChange={set("fullName")} style={inputStyle} />
        <input placeholder="Email (optional)" value={form.email} onChange={set("email")} style={inputStyle} />
        <input placeholder="Phone number" value={form.phone} onChange={set("phone")} style={inputStyle} />
        <input placeholder="City" value={form.city} onChange={set("city")} style={inputStyle} />
        <input placeholder="Address" value={form.address} onChange={set("address")} style={inputStyle} />
      </div>
      {error && <p style={{ color: "#A3402F", fontFamily: "Inter, sans-serif", fontSize: 13, marginBottom: 12 }}>{error}</p>}
      <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 0", borderTop: `1px solid ${C.line}`, fontFamily: "Inter, sans-serif" }}>
        <p style={{ fontSize: 15 }}>Total due</p>
        <p style={{ fontSize: 15, fontWeight: 600 }}>{money(subtotal)}</p>
      </div>
      <button onClick={placeOrder} disabled={placing} style={{ width: "100%", background: C.ink, color: C.warm, border: "none", padding: "15px 0", fontFamily: "Inter, sans-serif", fontSize: 14, cursor: placing ? "default" : "pointer", opacity: placing ? 0.7 : 1 }}>
        {placing ? "Placing order..." : "Continue to payment"}
      </button>
    </div>
  );
}

const inputStyle = { border: `1px solid ${C.line}`, padding: "12px 14px", fontFamily: "Inter, sans-serif", fontSize: 14, background: C.warm, color: C.char };

export default function SadaarMarketplace() {
  const [view, setView] = useState({ type: "home" });
  const [cart, setCart] = useState([]);
  const [brands, setBrands] = useState([]);
  const [homeProducts, setHomeProducts] = useState([]);
  const [homeLoading, setHomeLoading] = useState(true);
  const [homeError, setHomeError] = useState(null);
  const [returningPayment, setReturningPayment] = useState(null); // { status: 'checking'|'paid'|'error', orderId, total, message }

  const [showDebugBanner, setShowDebugBanner] = useState(false);
  const [debugBannerText, setDebugBannerText] = useState("");

  // Handle the return trip from Moyasar's 3D Secure redirect. Moyasar appends
  // ?id=<payment_id> to our callback_url after the bank's verification step,
  // and the page fully reloads at that point (wiping normal React state), so
  // we recover the pending order from sessionStorage and finish the job here.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentId = params.get("id");
    const pendingRaw = sessionStorage.getItem("sadaar_pending_order");

    setDebugBannerText(`url: ${window.location.href}\nid param: ${paymentId || "(none)"}\nsessionStorage pending: ${pendingRaw || "(none)"}`);
    setShowDebugBanner(true);

    if (!paymentId) return;

    window.history.replaceState({}, "", window.location.pathname); // clean the URL

    if (!pendingRaw) {
      setReturningPayment({ status: "error", message: "Payment returned, but we lost track of which order it belongs to. Please check your order status or contact support." });
      return;
    }
    const pending = JSON.parse(pendingRaw);
    setReturningPayment({ status: "checking", orderId: pending.orderId, total: pending.total });

    api(`/orders/${pending.orderId}/confirm-payment`, {
      method: "POST",
      body: JSON.stringify({ paymentId }),
    })
      .then(() => {
        sessionStorage.removeItem("sadaar_pending_order");
        setCart([]);
        setReturningPayment({ status: "paid", orderId: pending.orderId, total: pending.total });
      })
      .catch((e) => {
        setReturningPayment({ status: "error", orderId: pending.orderId, message: e.message });
      });
  }, []);

  useEffect(() => {
    setHomeLoading(true);
    Promise.all([api("/brands"), api("/products")])
      .then(([b, p]) => { setBrands(b); setHomeProducts(p); })
      .catch((e) => setHomeError(e.message))
      .finally(() => setHomeLoading(false));
  }, []);

  const openProduct = useCallback((id) => { setView({ type: "product", id }); window.scrollTo?.(0, 0); }, []);

  const addToCart = (product, variant, qty) => {
    setCart((prev) => {
      const idx = prev.findIndex((i) => i.variant.id === variant.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], qty: copy[idx].qty + qty };
        return copy;
      }
      return [...prev, { product, variant, qty }];
    });
  };

  const updateQty = (idx, delta) => setCart((prev) => { const c = [...prev]; c[idx] = { ...c[idx], qty: Math.max(1, c[idx].qty + delta) }; return c; });
  const removeItem = (idx) => setCart((prev) => prev.filter((_, i) => i !== idx));
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);

  return (
    <div style={{ background: C.sand, minHeight: "100vh" }}>
      <style>{FONTS}</style>

      {showDebugBanner && (
        <div style={{ background: "#22331F", color: "#DCEAD8", padding: "10px 16px", fontFamily: "monospace", fontSize: 11, whiteSpace: "pre-wrap", position: "relative" }}>
          {debugBannerText}
          <button onClick={() => setShowDebugBanner(false)} style={{ position: "absolute", top: 8, right: 12, background: "none", border: "none", color: "#DCEAD8", cursor: "pointer" }}>✕</button>
        </div>
      )}

      {returningPayment && (
        <div style={{ maxWidth: 560, margin: "0 auto", padding: "80px 24px", textAlign: "center" }}>
          {returningPayment.status === "checking" && (
            <>
              <Loader2 size={28} color={C.ink} style={{ animation: "spin 1s linear infinite", marginBottom: 16 }} />
              <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
              <p style={{ fontFamily: "Fraunces, serif", fontSize: 20, color: C.ink }}>Confirming your payment...</p>
            </>
          )}
          {returningPayment.status === "paid" && (
            <>
              <Check size={30} color={C.ink} style={{ marginBottom: 16 }} />
              <h1 style={{ fontFamily: "Fraunces, serif", fontSize: 26, color: C.ink, marginBottom: 8 }}>Payment received</h1>
              <p style={{ fontFamily: "Inter, sans-serif", fontSize: 14, color: C.muted, marginBottom: 24 }}>Order #{returningPayment.orderId} — {money(returningPayment.total)}. A confirmation email is on its way.</p>
              <button onClick={() => { setReturningPayment(null); setView({ type: "home" }); }} style={{ background: C.ink, color: C.warm, border: "none", padding: "12px 24px", fontFamily: "Inter, sans-serif", fontSize: 14, cursor: "pointer" }}>Back to SADAAR</button>
            </>
          )}
          {returningPayment.status === "error" && (
            <>
              <h1 style={{ fontFamily: "Fraunces, serif", fontSize: 24, color: C.ink, marginBottom: 8 }}>We couldn't confirm that payment</h1>
              <p style={{ fontFamily: "Inter, sans-serif", fontSize: 14, color: "#A3402F", marginBottom: 24 }}>{returningPayment.message}</p>
              <button onClick={() => { setReturningPayment(null); setView({ type: "home" }); }} style={{ background: C.ink, color: C.warm, border: "none", padding: "12px 24px", fontFamily: "Inter, sans-serif", fontSize: 14, cursor: "pointer" }}>Back to SADAAR</button>
            </>
          )}
        </div>
      )}

      {!returningPayment && (
        <>
          <Header setView={setView} cartCount={cartCount} onSearchClick={() => setView({ type: "browse" })} />

          {view.type === "home" && <Home setView={setView} openProduct={openProduct} products={homeProducts} brands={brands} loading={homeLoading} error={homeError} />}
          {view.type === "browse" && <Browse initialCat={view.cat} openProduct={openProduct} brands={brands} />}
          {view.type === "brands" && (
            <div style={{ maxWidth: 1180, margin: "0 auto", padding: "40px 24px 64px" }}>
              <h1 style={{ fontFamily: "Fraunces, serif", fontSize: 26, color: C.ink, marginBottom: 24 }}>All brands</h1>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
                {brands.map((b) => (
                  <div key={b.id} style={{ border: `1px solid ${C.line}`, padding: 20, background: C.warm }}>
                    <p style={{ margin: 0, fontFamily: "Fraunces, serif", fontSize: 18, color: C.ink }}>{b.name}</p>
                    <p style={{ margin: "6px 0 0", fontFamily: "Inter, sans-serif", fontSize: 13, color: C.muted }}>{b.description}</p>
                    <button onClick={() => setView({ type: "browse", cat: b.category })} style={{ marginTop: 14, background: "none", border: `1px solid ${C.ink}`, padding: "8px 14px", fontFamily: "Inter, sans-serif", fontSize: 12, cursor: "pointer" }}>Shop {b.name}</button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {view.type === "product" && <ProductDetail productId={view.id} onBack={() => setView({ type: "browse" })} onAddToCart={addToCart} />}
          {view.type === "cart" && <Cart items={cart} updateQty={updateQty} removeItem={removeItem} setView={setView} />}
          {view.type === "checkout" && <Checkout items={cart} setView={setView} clearCart={() => setCart([])} />}

          <Footer />
        </>
      )}
    </div>
  );
}
