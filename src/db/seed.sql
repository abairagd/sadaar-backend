-- Sample data mirroring the frontend mock catalog.
-- password_hash below is bcrypt for the plaintext "changeme123" — replace before going live.

INSERT INTO brands (name, slug, description, category, contact_email, password_hash, commission_rate, status) VALUES
('Nokhba Studio', 'nokhba-studio', 'Riyadh — tailored contemporary womenswear', 'Contemporary', 'hello@nokhba.example', '$2b$10$Q9x1o8m9wq3v3z1p3q6iueo8b2Zt6h8m0l8b0h0h0h0h0h0h0h0h0', 20.00, 'active'),
('Rukn', 'rukn', 'Jeddah — graphic streetwear & outerwear', 'Streetwear', 'hello@rukn.example', '$2b$10$Q9x1o8m9wq3v3z1p3q6iueo8b2Zt6h8m0l8b0h0h0h0h0h0h0h0h0', 20.00, 'active'),
('Dahiya House', 'dahiya-house', 'Al Khobar — modern tailored abayas', 'Abayas', 'hello@dahiya.example', '$2b$10$Q9x1o8m9wq3v3z1p3q6iueo8b2Zt6h8m0l8b0h0h0h0h0h0h0h0h0', 18.00, 'active'),
('Latif & Co', 'latif-co', 'Riyadh — handcrafted leather footwear', 'Footwear', 'hello@latif.example', '$2b$10$Q9x1o8m9wq3v3z1p3q6iueo8b2Zt6h8m0l8b0h0h0h0h0h0h0h0h0', 22.00, 'active'),
('Aseel Atelier', 'aseel-atelier', 'Jeddah — leather goods & jewelry', 'Accessories', 'hello@aseel.example', '$2b$10$Q9x1o8m9wq3v3z1p3q6iueo8b2Zt6h8m0l8b0h0h0h0h0h0h0h0h0', 20.00, 'active'),
('Thoub Modern', 'thoub-modern', 'Riyadh — reimagined menswear staples', 'Contemporary', 'hello@thoubmodern.example', '$2b$10$Q9x1o8m9wq3v3z1p3q6iueo8b2Zt6h8m0l8b0h0h0h0h0h0h0h0h0', 20.00, 'active');

INSERT INTO products (brand_id, name, description, category, price) VALUES
(1, 'Draped Wool Coat', 'Structured wool coat with a soft drape, cut for layering through cooler evenings.', 'Contemporary', 890.00),
(2, 'Oversized Logo Hoodie', 'Heavyweight cotton hoodie with embroidered wordmark, boxy fit.', 'Streetwear', 340.00),
(3, 'Silk Tailored Abaya', 'Fluid silk-blend abaya with a tailored shoulder line and covered placket.', 'Abayas', 620.00),
(4, 'Hand-Stitched Loafer', 'Full-grain leather loafer, hand-stitched sole, made in small batches.', 'Footwear', 480.00),
(5, 'Woven Leather Belt', 'Braided leather belt with a solid brass buckle.', 'Accessories', 210.00),
(6, 'Relaxed Linen Thobe', 'Breathable linen thobe with a relaxed, modern cut.', 'Contemporary', 410.00),
(1, 'Ribbed Knit Set', 'Two-piece ribbed knit set in a matte finish.', 'Contemporary', 460.00),
(2, 'Cargo Utility Pant', 'Tapered cargo pant with reinforced stitching and multiple pockets.', 'Streetwear', 380.00),
(3, 'Embroidered Kaftan', 'Hand-embroidered kaftan in a flowing silhouette.', 'Abayas', 710.00),
(5, 'Structured Tote', 'Structured leather tote with a suede-lined interior.', 'Accessories', 590.00),
(4, 'Minimal Leather Sandal', 'Clean-lined leather sandal with a cushioned footbed.', 'Footwear', 320.00),
(6, 'Structured Bisht Jacket', 'Modern bisht-inspired jacket in brushed wool.', 'Contemporary', 980.00);

-- Variants (sizes + starting stock) for each product, in product insertion order (ids 1-12)
INSERT INTO product_variants (product_id, size, sku, stock_qty) VALUES
(1,'S','NOKHBA-COAT-S',8), (1,'M','NOKHBA-COAT-M',10), (1,'L','NOKHBA-COAT-L',6),
(2,'S','RUKN-HOOD-S',12), (2,'M','RUKN-HOOD-M',15), (2,'L','RUKN-HOOD-L',10), (2,'XL','RUKN-HOOD-XL',6),
(3,'S','DAHIYA-ABAYA-S',5), (3,'M','DAHIYA-ABAYA-M',7), (3,'L','DAHIYA-ABAYA-L',5),
(4,'40','LATIF-LOAF-40',4), (4,'41','LATIF-LOAF-41',6), (4,'42','LATIF-LOAF-42',6), (4,'43','LATIF-LOAF-43',4), (4,'44','LATIF-LOAF-44',3),
(5,'One size','ASEEL-BELT-OS',20),
(6,'S','THOUB-LINEN-S',9), (6,'M','THOUB-LINEN-M',11), (6,'L','THOUB-LINEN-L',8), (6,'XL','THOUB-LINEN-XL',5),
(7,'S','NOKHBA-KNIT-S',7), (7,'M','NOKHBA-KNIT-M',9), (7,'L','NOKHBA-KNIT-L',6),
(8,'S','RUKN-CARGO-S',8), (8,'M','RUKN-CARGO-M',10), (8,'L','RUKN-CARGO-L',7), (8,'XL','RUKN-CARGO-XL',5),
(9,'S','DAHIYA-KAFTAN-S',4), (9,'M','DAHIYA-KAFTAN-M',6), (9,'L','DAHIYA-KAFTAN-L',4),
(10,'One size','ASEEL-TOTE-OS',10),
(11,'39','LATIF-SAND-39',5), (11,'40','LATIF-SAND-40',6), (11,'41','LATIF-SAND-41',6), (11,'42','LATIF-SAND-42',5), (11,'43','LATIF-SAND-43',4),
(12,'S','THOUB-BISHT-S',4), (12,'M','THOUB-BISHT-M',5), (12,'L','THOUB-BISHT-L',4);
