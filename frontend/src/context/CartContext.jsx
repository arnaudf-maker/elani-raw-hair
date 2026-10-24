import React, { createContext, useContext, useEffect, useState } from "react";

const CartContext = createContext(null);
export const useCart = () => useContext(CartContext);

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    try { return JSON.parse(localStorage.getItem("cart") || "[]"); } catch { return []; }
  });
  const [open, setOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem("cart", JSON.stringify(items));
  }, [items]);

  const add = (product, quantity = 1, extra = {}) => {
    setItems((prev) => {
      const found = prev.find((i) =>
        i.product_id === product.id &&
        (i.inches ?? null) === (extra.inches ?? null) &&
        (i.texture ?? null) === (extra.texture ?? null)
      );
      if (found) {
        return prev.map((i) =>
          i.product_id === product.id &&
          (i.inches ?? null) === (extra.inches ?? null) &&
          (i.texture ?? null) === (extra.texture ?? null)
            ? { ...i, quantity: i.quantity + quantity }
            : i
        );
      }
      return [...prev, {
        product_id: product.id, name: product.name, price: product.price,
        image: product.images?.[0], quantity,
        inches: extra.inches ?? null, texture: extra.texture ?? null,
      }];
    });
    setOpen(true);
  };

  const remove = (id, inches = null, texture = null) =>
    setItems((prev) => prev.filter((i) => !(
      i.product_id === id &&
      (i.inches ?? null) === (inches ?? null) &&
      (i.texture ?? null) === (texture ?? null)
    )));
  const setQty = (id, q, inches = null, texture = null) =>
    setItems((prev) => prev.map((i) =>
      i.product_id === id &&
      (i.inches ?? null) === (inches ?? null) &&
      (i.texture ?? null) === (texture ?? null)
        ? { ...i, quantity: Math.max(1, q) } : i
    ));
  const clear = () => setItems([]);

  const count = items.reduce((s, i) => s + i.quantity, 0);
  const total = items.reduce((s, i) => s + i.price * i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, add, remove, setQty, clear, count, total, open, setOpen }}>
      {children}
    </CartContext.Provider>
  );
}
