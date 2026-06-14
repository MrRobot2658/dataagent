import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "zh" | "en";

// 框架层（App Shell）多语言文案。页面正文暂以中文为主，可按需扩充。
const DICT = {
  workspace: { zh: "工作区", en: "Workspace" },
  brandSub: { zh: "CDP · 客户数据平台", en: "CDP · Customer Data Platform" },
  footer: { zh: "sql-engine · DSL 引擎", en: "sql-engine · DSL Engine" },
  search: { zh: "搜索 Sources / Audiences / Profiles…", en: "Search Sources / Audiences / Profiles…" },
  tenant: { zh: "租户", en: "Tenant" },
} as const;

type DictKey = keyof typeof DICT;

interface LangCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (k: DictKey) => string;
}

const Ctx = createContext<LangCtx>({
  lang: "zh", setLang: () => {}, t: (k) => DICT[k]?.zh ?? String(k),
});

const STORAGE_KEY = "cdp_lang";

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const saved = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    return saved === "en" ? "en" : "zh";
  });

  const setLang = (l: Lang) => {
    setLangState(l);
    try { localStorage.setItem(STORAGE_KEY, l); } catch { /* ignore */ }
  };

  useEffect(() => {
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
  }, [lang]);

  const t = (k: DictKey) => DICT[k]?.[lang] ?? String(k);

  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}

export const useLang = () => useContext(Ctx);
