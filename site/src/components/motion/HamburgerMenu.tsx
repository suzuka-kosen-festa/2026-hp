import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import "./HamburgerMenu.css";

interface NavItem {
  label: string;
  href: string;
}

interface Props {
  navItems: NavItem[];
  currentPath: string;
}

function isActive(href: string, currentPath: string) {
  if (href === "/") return currentPath === "/";
  return currentPath.startsWith(href);
}

export default function HamburgerMenu({ navItems, currentPath }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <button
        type="button"
        className={`hamburger${open ? " is-open" : ""}`}
        aria-expanded={open}
        aria-label={open ? "メニューを閉じる" : "メニューを開く"}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="bar b1" />
        <span className="bar b2" />
        <span className="bar b3" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.nav
            className="sp-menu"
            aria-label="メインナビゲーション"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <ul>
              {navItems.map((item, i) => (
                <motion.li
                  key={item.href}
                  initial={{ opacity: 0, x: -30, rotate: -3 }}
                  animate={{ opacity: 1, x: 0, rotate: (i % 2 === 0 ? -1 : 1) * 2 }}
                  exit={{ opacity: 0, x: -30 }}
                  transition={{ delay: i * 0.05, duration: 0.3 }}
                >
                  <a
                    href={item.href}
                    aria-current={isActive(item.href, currentPath) ? "page" : undefined}
                    onClick={() => setOpen(false)}
                  >
                    {item.label}
                  </a>
                </motion.li>
              ))}
            </ul>
            <button type="button" className="close-btn" onClick={() => setOpen(false)} aria-label="メニューを閉じる">
              ✕
            </button>
          </motion.nav>
        )}
      </AnimatePresence>
    </>
  );
}
