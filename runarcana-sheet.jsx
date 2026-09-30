import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Dices,
  Shield,
  Lock,
  Unlock,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  Search,
  Plus,
  X,
  Heart,
  Sparkles,
  Footprints,
  Swords,
  Wand2,
  BookOpen,
  Backpack,
  ScrollText,
  Settings,
  Share2,
  MessageSquare,
  User,
  Award,
} from "lucide-react";

/* =============================================================================
   RUNARCANA — Ficha de Personagem · estética C.R.I.S.
   Regras conferidas em wiki.runarcana.org (D&D 5e adaptado a Runeterra):
   • 6 atributos, 18 perícias oficiais (+ Tecnologia, homebrew comum em mesas
     ambientadas em Piltover/Zaun — fácil de remover se não usar).
   • d20 + mod. de atributo (+ bônus de proficiência, se treinado).
   • Bônus de Proficiência escala com o nível: +2(1-4) +3(5-8) +4(9-12)
     +5(13-16) +6(17-20).
   • Não existe "Sanidade" em Runarcana — o recurso azul/roxo aqui é
     Pontos de Magia (mana/ki/fúria, nomeável pela classe do personagem).
   ============================================================================= */

const ATTRS = [
  { key: "for", label: "Força", short: "FOR" },
  { key: "des", label: "Destreza", short: "DES" },
  { key: "con", label: "Constituição", short: "CON" },
  { key: "int", label: "Inteligência", short: "INT" },
  { key: "sab", label: "Sabedoria", short: "SAB" },
  { key: "car", label: "Carisma", short: "CAR" },
];

const SKILLS = [
  { name: "Acrobacia", attr: "des" },
  { name: "Arcanismo", attr: "int" },
  { name: "Atletismo", attr: "for" },
  { name: "Atuação", attr: "car" },
  { name: "Enganação", attr: "car" },
  { name: "Furtividade", attr: "des" },
  { name: "História", attr: "int" },
  { name: "Intimidação", attr: "car" },
  { name: "Intuição", attr: "sab" },
  { name: "Investigação", attr: "int" },
  { name: "Lidar com Animais", attr: "sab" },
  { name: "Medicina", attr: "sab" },
  { name: "Natureza", attr: "int" },
  { name: "Percepção", attr: "sab" },
  { name: "Persuasão", attr: "car" },
  { name: "Prestidigitação", attr: "des" },
  { name: "Religião", attr: "int" },
  { name: "Sobrevivência", attr: "sab" },
  { name: "Tecnologia", attr: "int" },
];

const TABS = [
  { name: "Combate", icon: Swords },
  { name: "Magias/Runas", icon: Wand2 },
  { name: "Heranças", icon: BookOpen },
  { name: "Inventário", icon: Backpack },
  { name: "Anotações", icon: ScrollText },
];

const STORAGE_KEY = "runarcana:ficha-cris";

const defaultChar = () => ({
  // Cabeçalho segue exatamente os 7 campos da ficha oficial: Jogador, Personagem,
  // Origem, Região, Passado, Moral, Classe e Nível — sem campo "Raça" (Origem já
  // cobre isso em Runarcana: Humano, Vastaya, Yordle etc).
  header: { nome: "", jogador: "", origem: "", regiao: "", passado: "", moral: "", classe: "", nivel: 1 },
  campanha: "",
  portrait: null,
  attrs: {
    for: { score: 10 },
    des: { score: 10 },
    con: { score: 10 },
    int: { score: 10 },
    sab: { score: 10 },
    car: { score: 10 },
  },
  savesTreino: {},
  skillsTreino: {},
  skillsOutros: {},
  inspiracao: 0,
  extras: {
    prof: 0,
    iniciativa: 0,
    percepcao: 0,
    intuicao: 0,
    magiaCD: 0,
    magiaAtk: 0,
    runaCD: 0,
    runaAtk: 0,
  },
  caExtra: 0,
  caEscudo: 0,
  deslocamento: "9m",
  hp: { cur: 10, max: 10, temp: 0 },
  hitDice: "1d8",
  deathSaves: { success: 0, fail: 0 },
  exhaustion: 0,
  xp: 0,
  magia: { label: "Pontos de Mana", cur: 0, max: 0, attr: "int" },
  resistencias: "",
  proficienciasArmas: "",
  linguas: "",
  moedas: { pp: 0, pe: 0, po: 0, pl: 0 },
  attackFilter: "",
  freeRoll: "",
  attacks: [{ id: "a1", nome: "Adaga Rúnica", bonus: "+3", dano: "1d4 + 1", tipo: "Perfurante", open: true }],
  habilidades: [{ id: "h1", nome: "", desc: "" }],
  magias: [{ id: "m1", nome: "", custo: "", desc: "" }],
  runas: "",
  inventario: [{ id: "i1", item: "", qtd: 1, notas: "" }],
  bio: "",
});

const clampLevel = (n) => Math.max(1, Math.min(20, Number(n) || 1));
const profBonus = (level) => 2 + Math.floor((clampLevel(level) - 1) / 4);
const mod = (score) => Math.floor((Number(score ?? 10) - 10) / 2);
const fmtMod = (m) => (m >= 0 ? `+${m}` : `${m}`);
const uid = () => Math.random().toString(36).slice(2, 9);

function secureRoll(die) {
  if (window.crypto && window.crypto.getRandomValues) {
    const buf = new Uint32Array(1);
    const max = Math.floor(0xffffffff / die) * die;
    let x;
    do {
      window.crypto.getRandomValues(buf);
      x = buf[0];
    } while (x >= max);
    return (x % die) + 1;
  }
  return Math.floor(Math.random() * die) + 1;
}

async function loadChar() {
  try {
    const res = await window.storage.get(STORAGE_KEY, false);
    if (res && res.value) return JSON.parse(res.value);
  } catch (e) {}
  return null;
}
async function saveChar(data) {
  try {
    await window.storage.set(STORAGE_KEY, JSON.stringify(data), false);
    return true;
  } catch (e) {
    return false;
  }
}

/* ================================ UI atoms ================================ */

function Label({ children, className = "" }) {
  return <div className={`text-[10px] tracking-[0.15em] uppercase text-gray-500 ${className}`}>{children}</div>;
}

function Underline({ value, onChange, className = "", ...rest }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full bg-transparent border-b border-zinc-800 focus:border-red-700 pb-0.5 text-sm text-gray-200 focus:outline-none transition-colors ${className}`}
      {...rest}
    />
  );
}

function HField({ label, value, onChange, type = "text" }) {
  return (
    <div>
      <Label>{label}</Label>
      <Underline value={value} onChange={onChange} type={type} />
    </div>
  );
}

function RollIcon({ onClick, size = 15, title = "Rolar d20" }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="shrink-0 text-gray-600 hover:text-violet-400 transition-colors"
    >
      <Dices size={size} strokeWidth={1.6} />
    </button>
  );
}

function ExtraBonus({ value, onChange, title = "Ajuste manual" }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-[9px] text-zinc-600" title={title}>
      <span>manual</span>
      <input
        type="number"
        value={value || 0}
        onChange={(e) => onChange(e.target.value)}
        className="w-7 bg-transparent border-b border-zinc-800 text-center text-zinc-400 focus:outline-none focus:border-red-800 focus:text-white"
      />
    </span>
  );
}

function StatBox({ label, children, icon: Icon, extra }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="w-16 h-14 border border-zinc-800 rounded flex flex-col items-center justify-center gap-0.5">
        {Icon && <Icon size={12} className="text-gray-600" strokeWidth={1.6} />}
        <div className="text-lg font-semibold text-gray-100">{children}</div>
      </div>
      <Label className="text-center">{label}</Label>
      {extra}
    </div>
  );
}

/* ------------------------------ Status bar (Vida / Magia) ------------------------------ */

function StatusBar({ label, icon: Icon, cur, max, from, to, editableLabel, onChange }) {
  const pct = Math.max(0, Math.min(100, (cur / Math.max(1, max)) * 100));
  const step = (d) => onChange({ cur: Math.max(0, Math.min(max, cur + d)) });
  return (
    <div>
      <div className="flex items-center justify-center gap-1.5 mb-1">
        {Icon && <Icon size={11} className="text-gray-500" strokeWidth={1.8} />}
        {editableLabel ? (
          <input
            value={label}
            onChange={(e) => onChange({ label: e.target.value })}
            className="text-[10px] tracking-[0.15em] uppercase text-gray-500 bg-transparent text-center focus:outline-none focus:text-violet-400 w-32"
          />
        ) : (
          <Label>{label}</Label>
        )}
      </div>
      <div className={`relative h-10 rounded border border-zinc-800 overflow-hidden bg-gradient-to-b ${from}`}>
        <div
          className={`absolute inset-y-0 left-0 transition-all duration-300 bg-gradient-to-r ${to}`}
          style={{ width: `${pct}%` }}
        />
        <div className="relative h-full flex items-center justify-between px-0.5">
          <div className="flex items-center h-full">
            <button onClick={() => step(-5)} className="px-1 text-gray-500 hover:text-white">
              <ChevronsLeft size={14} />
            </button>
            <button onClick={() => step(-1)} className="px-1 text-gray-500 hover:text-white">
              <ChevronLeft size={14} />
            </button>
          </div>
          <div className="flex items-baseline gap-1">
            <input
              type="number"
              value={cur}
              onChange={(e) => onChange({ cur: Number(e.target.value) })}
              className="w-10 bg-transparent text-center text-lg font-bold text-white focus:outline-none [text-shadow:0_1px_3px_rgba(0,0,0,0.8)]"
            />
            <span className="text-white/50">/</span>
            <input
              type="number"
              value={max}
              onChange={(e) => onChange({ max: Number(e.target.value) })}
              className="w-10 bg-transparent text-center text-sm text-white/70 focus:outline-none"
            />
          </div>
          <div className="flex items-center h-full">
            <button onClick={() => step(1)} className="px-1 text-gray-500 hover:text-white">
              <ChevronRight size={14} />
            </button>
            <button onClick={() => step(5)} className="px-1 text-gray-500 hover:text-white">
              <ChevronsRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ Portrait ------------------------------ */

function Portrait({ src, onChange }) {
  const ref = useRef(null);
  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = () => onChange(r.result);
    r.readAsDataURL(file);
  };
  return (
    <div
      className="w-16 h-16 shrink-0 rounded-lg border border-zinc-800 bg-zinc-950 overflow-hidden cursor-pointer flex items-center justify-center"
      onClick={() => ref.current?.click()}
    >
      {src ? (
        <img src={src} alt="Retrato" className="w-full h-full object-cover" />
      ) : (
        <User size={26} className="text-zinc-700" strokeWidth={1.3} />
      )}
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
}

/* --------------------------- Hexagrama de atributos --------------------------- */

function AttrHex({ attrs, locked, onToggleLock, onScoreChange, onRoll }) {
  const R = 84;
  const cx = 114,
    cy = 114;
  const pos = ATTRS.map((a, i) => {
    const angle = -90 + i * 60;
    const rad = (angle * Math.PI) / 180;
    return { ...a, x: cx + R * Math.cos(rad), y: cy + R * Math.sin(rad) };
  });

  return (
    <div className="relative mx-auto flex items-center justify-center" style={{ width: 228, height: 228 }}>
      <button
        onClick={onToggleLock}
        className="absolute top-0 right-4 text-gray-600 hover:text-violet-400 transition-colors z-10"
        title={locked ? "Destravar valores" : "Travar valores"}
      >
        {locked ? <Lock size={13} /> : <Unlock size={13} />}
      </button>

      <svg viewBox="0 0 228 228" width="228" height="228" className="absolute inset-0">
        <circle cx={cx} cy={cy} r={R + 28} fill="none" stroke="#18181b" strokeWidth="1" strokeDasharray="1 5" />
        <polygon
          points={pos.map((p) => `${p.x},${p.y}`).join(" ")}
          fill="none"
          stroke="#27272a"
          strokeWidth="1"
        />
      </svg>

      <div className="absolute rounded-full border border-zinc-700 bg-zinc-950 flex items-center justify-center" style={{ width: 74, height: 74, left: cx - 37, top: cy - 37 }}>
        <span className="text-[10px] tracking-[0.2em] uppercase text-gray-400 font-medium">Atributos</span>
      </div>

      {pos.map((p) => {
        const a = attrs[p.key];
        const m = mod(a.score);
        return (
          <div key={p.key} className="absolute flex flex-col items-center" style={{ left: p.x - 27, top: p.y - 27, width: 54 }}>
            <div
              className="relative w-[54px] h-[54px] rounded-full border border-white/70 bg-zinc-950 flex flex-col items-center justify-center cursor-pointer hover:border-violet-400 transition-colors"
              onClick={() => onRoll(p.label, m)}
              title={`Rolar teste de ${p.label}`}
            >
              {locked ? (
                <span className="text-xl font-bold text-white leading-none">{a.score}</span>
              ) : (
                <input
                  type="number"
                  value={a.score}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => onScoreChange(p.key, Number(e.target.value))}
                  className="w-8 bg-transparent text-center text-xl font-bold text-white leading-none focus:outline-none"
                />
              )}
              <span className="text-[10px] text-gray-400 mt-0.5">{p.short}</span>
            </div>
            <span className="text-[10px] text-violet-400 mt-1 font-medium">{fmtMod(m)}</span>
          </div>
        );
      })}
    </div>
  );
}

/* --------------------------------- Dice modal --------------------------------- */

function DiceModal({ roll, onClose, onReroll }) {
  const [phase, setPhase] = useState("rolling");
  const [display, setDisplay] = useState(1);

  useEffect(() => {
    if (!roll) return;
    setPhase("rolling");
    let n = 0;
    const iv = setInterval(() => {
      setDisplay(secureRoll(roll.die));
      n++;
      if (n > 9) {
        clearInterval(iv);
        setPhase("done");
      }
    }, 45);
    return () => clearInterval(iv);
  }, [roll]);

  if (!roll) return null;
  const { label, mod: m, mode, r1, r2 } = roll;
  const chosen = mode === "adv" ? Math.max(r1, r2) : mode === "dis" ? Math.min(r1, r2) : r1;
  const total = chosen + m;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-zinc-950 border border-red-900/60 rounded-xl px-10 py-8 text-center min-w-[250px]"
        style={{ boxShadow: "0 0 60px rgba(153,27,27,0.25)" }}
      >
        <div className="text-[11px] tracking-[0.2em] text-gray-500 uppercase mb-3">{label}</div>
        <div className={`text-6xl font-bold transition-colors ${phase === "rolling" ? "text-zinc-700" : "text-white"}`}>
          {phase === "rolling" ? display : total}
        </div>
        {phase === "done" && (
          <div className="text-xs text-gray-500 mt-2">
            {mode === "normal" && `d${roll.die} (${r1}) ${fmtMod(m)}`}
            {mode === "adv" && (
              <>
                <span className="text-emerald-400">vantagem</span> · d{roll.die} ({r1}, {r2}) → {chosen} {fmtMod(m)}
              </>
            )}
            {mode === "dis" && (
              <>
                <span className="text-red-400">desvantagem</span> · d{roll.die} ({r1}, {r2}) → {chosen} {fmtMod(m)}
              </>
            )}
          </div>
        )}
        {phase === "done" && (
          <div className="flex items-center justify-center gap-4 mt-5 text-[10px] tracking-[0.12em] uppercase">
            <button onClick={() => onReroll("adv")} className="text-emerald-400/80 hover:text-emerald-400">
              Vantagem
            </button>
            <button onClick={() => onReroll("normal")} className="text-violet-400 hover:text-violet-300">
              Rolar de novo
            </button>
            <button onClick={() => onReroll("dis")} className="text-red-400/80 hover:text-red-400">
              Desvantagem
            </button>
          </div>
        )}
        <button onClick={onClose} className="mt-4 text-[10px] tracking-[0.15em] uppercase text-gray-600 hover:text-gray-300">
          fechar
        </button>
      </div>
    </div>
  );
}

/* ------------------------------- Editable list ------------------------------- */

function EditableList({ items, fields, onChange, addLabel = "Adicionar" }) {
  const update = (id, key, val) => onChange(items.map((it) => (it.id === id ? { ...it, [key]: val } : it)));
  const remove = (id) => onChange(items.filter((it) => it.id !== id));
  const add = () => onChange([...items, { id: uid(), ...Object.fromEntries(fields.map((f) => [f.key, ""])) }]);

  return (
    <div className="space-y-2">
      {items.map((it) => (
        <div key={it.id} className="flex items-start gap-2 group">
          <div className="grid gap-2 flex-1" style={{ gridTemplateColumns: fields.map((f) => f.width || "1fr").join(" ") }}>
            {fields.map((f) =>
              f.area ? (
                <textarea
                  key={f.key}
                  rows={2}
                  value={it[f.key] || ""}
                  onChange={(e) => update(it.id, f.key, e.target.value)}
                  placeholder={f.placeholder}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-red-800 resize-y"
                />
              ) : (
                <input
                  key={f.key}
                  value={it[f.key] || ""}
                  onChange={(e) => update(it.id, f.key, e.target.value)}
                  placeholder={f.placeholder}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-red-800"
                />
              )
            )}
          </div>
          <button onClick={() => remove(it.id)} className="mt-1.5 text-zinc-700 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
            <X size={13} />
          </button>
        </div>
      ))}
      <button onClick={add} className="flex items-center gap-1 text-[11px] tracking-[0.1em] uppercase text-violet-400 hover:text-violet-300">
        <Plus size={12} /> {addLabel}
      </button>
    </div>
  );
}

/* --------------------------------- Weapon card --------------------------------- */

function WeaponCard({ atk, onChange, onRemove, onRoll }) {
  return (
    <div className="bg-zinc-900/40 rounded-lg px-3 py-2.5 mb-2 border border-zinc-800/60">
      <div className="flex items-center gap-2">
        <button onClick={() => onChange({ ...atk, open: !atk.open })} className="text-gray-600 shrink-0">
          {atk.open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </button>
        <input
          value={atk.nome}
          onChange={(e) => onChange({ ...atk, nome: e.target.value })}
          placeholder="Nome da arma"
          className="bg-transparent text-sm font-medium text-gray-100 flex-1 focus:outline-none"
        />
        <RollIcon onClick={onRoll} />
        <button onClick={onRemove} className="text-zinc-700 hover:text-red-500">
          <X size={13} />
        </button>
      </div>
      {atk.open && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 mt-2.5 pl-5 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-violet-400">Bônus:</span>
            <input
              value={atk.bonus}
              onChange={(e) => onChange({ ...atk, bonus: e.target.value })}
              className="bg-transparent text-gray-200 w-12 focus:outline-none border-b border-zinc-800 focus:border-red-700"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-violet-400">Dano:</span>
            <input
              value={atk.dano}
              onChange={(e) => onChange({ ...atk, dano: e.target.value })}
              className="bg-transparent text-gray-200 w-20 focus:outline-none border-b border-zinc-800 focus:border-red-700"
            />
          </div>
          <div className="flex items-center gap-1.5 flex-1 min-w-[110px]">
            <span className="text-violet-400">Tipo:</span>
            <input
              value={atk.tipo}
              onChange={(e) => onChange({ ...atk, tipo: e.target.value })}
              className="bg-transparent text-gray-200 flex-1 focus:outline-none border-b border-zinc-800 focus:border-red-700"
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* ----------------------------------- App ----------------------------------- */

export default function RunarcanaSheet() {
  const [char, setChar] = useState(defaultChar());
  const [roll, setRoll] = useState(null);
  const [tab, setTab] = useState("Combate");
  const [status, setStatus] = useState("loading");
  const [locked, setLocked] = useState(false);
  const saveTimer = useRef(null);
  const firstLoad = useRef(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const loaded = await loadChar();
      if (!mounted) return;
      if (loaded) {
        const d = defaultChar();
        setChar({
          ...d,
          ...loaded,
          header: { ...d.header, ...(loaded.header || {}) },
          attrs: { ...d.attrs, ...(loaded.attrs || {}) },
          hp: { ...d.hp, ...(loaded.hp || {}) },
          magia: { ...d.magia, ...(loaded.magia || {}) },
          moedas: { ...d.moedas, ...(loaded.moedas || {}) },
          deathSaves: { ...d.deathSaves, ...(loaded.deathSaves || {}) },
          extras: { ...d.extras, ...(loaded.extras || {}) },
          // versões antigas guardavam "runas" como lista; a ficha oficial usa um
          // campo de texto livre, então descartamos formatos incompatíveis.
          runas: typeof loaded.runas === "string" ? loaded.runas : d.runas,
        });
      }
      setStatus("ready");
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (firstLoad.current) {
      firstLoad.current = false;
      return;
    }
    if (status === "loading") return;
    setStatus("saving");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const ok = await saveChar(char);
      setStatus(ok ? "saved" : "offline");
    }, 500);
    return () => clearTimeout(saveTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [char]);

  const setHeader = (key, val) => setChar((c) => ({ ...c, header: { ...c.header, [key]: val } }));
  const setAttrScore = (key, score) => setChar((c) => ({ ...c, attrs: { ...c.attrs, [key]: { score } } }));
  const toggleSaveTreino = (key) => setChar((c) => ({ ...c, savesTreino: { ...c.savesTreino, [key]: !c.savesTreino[key] } }));
  const toggleSkillTreino = (name) => setChar((c) => ({ ...c, skillsTreino: { ...c.skillsTreino, [name]: !c.skillsTreino[name] } }));
  const setSkillOutros = (name, val) => setChar((c) => ({ ...c, skillsOutros: { ...c.skillsOutros, [name]: val } }));

  const doRoll = useCallback((label, m, mode = "normal", die = 20) => {
    const r1 = secureRoll(die);
    const r2 = mode === "normal" ? null : secureRoll(die);
    setRoll({ label, mod: m, die, mode, r1, r2 });
  }, []);
  const reroll = useCallback((mode) => roll && doRoll(roll.label, roll.mod, mode, roll.die), [roll, doRoll]);

  const ex = char.extras;
  const setExtra = (key, val) => setChar((c) => ({ ...c, extras: { ...c.extras, [key]: Number(val) || 0 } }));
  const prof = profBonus(char.header.nivel) + Number(ex.prof || 0);
  const caTotal = 10 + mod(char.attrs.des.score) + Number(char.caExtra || 0) + Number(char.caEscudo || 0);
  const iniciativa = mod(char.attrs.des.score) + Number(ex.iniciativa || 0);
  const halfLevel = Math.max(1, Math.floor(clampLevel(char.header.nivel) / 2));
  const passivaPercepcao =
    10 + mod(char.attrs.sab.score) + (char.skillsTreino["Percepção"] ? prof : 0) + Number(ex.percepcao || 0);
  const passivaIntuicao =
    10 + mod(char.attrs.sab.score) + (char.skillsTreino["Intuição"] ? prof : 0) + Number(ex.intuicao || 0);

  const filteredAttacks = useMemo(() => {
    const q = char.attackFilter.trim().toLowerCase();
    if (!q) return char.attacks;
    return char.attacks.filter((a) => (a.nome || "").toLowerCase().includes(q));
  }, [char.attacks, char.attackFilter]);

  const statusLabel = { loading: "Carregando…", saving: "Salvando…", saved: "Salvo", offline: "Alterações locais" }[status];

  return (
    <div className="min-h-screen w-full bg-black text-gray-300 font-sans">
      <style>{`
        input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; }
        ::selection { background: #7f1d1d99; }
        ::-webkit-scrollbar { width: 7px; height: 7px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #27272a; border-radius: 4px; }
      `}</style>

      <div className="h-[2px] w-full bg-gradient-to-r from-red-800 via-violet-700 to-red-800" />

      {/* ================= HEADER ================= */}
      <header className="px-6 pt-5 pb-4 border-b border-zinc-900">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-start gap-4">
            <Portrait src={char.portrait} onChange={(v) => setChar((c) => ({ ...c, portrait: v }))} />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-2.5 w-full max-w-[440px]">
              <HField label="Personagem" value={char.header.nome} onChange={(v) => setHeader("nome", v)} />
              <HField label="Jogador" value={char.header.jogador} onChange={(v) => setHeader("jogador", v)} />
              <HField label="Origem" value={char.header.origem} onChange={(v) => setHeader("origem", v)} />
              <HField label="Região" value={char.header.regiao} onChange={(v) => setHeader("regiao", v)} />
              <HField label="Passado" value={char.header.passado} onChange={(v) => setHeader("passado", v)} />
              <HField label="Moral" value={char.header.moral} onChange={(v) => setHeader("moral", v)} />
              <HField label="Classe" value={char.header.classe} onChange={(v) => setHeader("classe", v)} />
              <HField
                label="Nível"
                value={char.header.nivel}
                type="number"
                onChange={(v) => setHeader("nivel", clampLevel(v))}
              />
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-3">
              <MessageSquare size={16} className="text-gray-600" strokeWidth={1.6} />
              <div>
                <Label className="text-right">Campanha</Label>
                <Underline
                  value={char.campanha}
                  onChange={(v) => setChar((c) => ({ ...c, campanha: v }))}
                  className="text-right w-48"
                  placeholder="Nome da campanha"
                />
              </div>
              <Share2 size={15} className="text-gray-600 hover:text-gray-300 cursor-pointer" strokeWidth={1.6} />
              <Settings size={15} className="text-gray-600 hover:text-gray-300 cursor-pointer" strokeWidth={1.6} />
            </div>
            <span className="text-[9px] tracking-[0.12em] uppercase text-zinc-700">{statusLabel}</span>
          </div>
        </div>
      </header>

      {/* ================= BODY — grade fixa de 3 colunas lado a lado ================= */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 w-full max-w-7xl mx-auto mt-8 px-6 pb-10 items-start">
        {/* -------- COLUNA 1 · ESQUERDA: atributos / CA / iniciativa / deslocamento / barras -------- */}
        <div className="col-span-1 md:col-span-4 flex flex-col space-y-5">
          <AttrHex
            attrs={char.attrs}
            locked={locked}
            onToggleLock={() => setLocked((l) => !l)}
            onScoreChange={setAttrScore}
            onRoll={(label, m) => doRoll(`Teste de ${label}`, m)}
          />

          <div className="flex justify-center gap-2.5 flex-wrap">
            <StatBox label="B.P." icon={Award} extra={<ExtraBonus value={ex.prof} onChange={(v) => setExtra("prof", v)} />}>
              {fmtMod(prof)}
            </StatBox>
            <StatBox label="Inspiração" icon={Sparkles}>
              <input
                type="number"
                value={char.inspiracao}
                onChange={(e) => setChar((c) => ({ ...c, inspiracao: Number(e.target.value) }))}
                className="w-10 bg-transparent text-center focus:outline-none"
              />
            </StatBox>
            <StatBox
              label="Iniciativa"
              icon={Dices}
              extra={<ExtraBonus value={ex.iniciativa} onChange={(v) => setExtra("iniciativa", v)} />}
            >
              {fmtMod(iniciativa)}
            </StatBox>
            <StatBox label="Desloc." icon={Footprints}>
              <input
                value={char.deslocamento}
                onChange={(e) => setChar((c) => ({ ...c, deslocamento: e.target.value }))}
                className="w-full bg-transparent text-center text-base focus:outline-none"
              />
            </StatBox>
            <div className="flex flex-col items-center gap-1.5">
              <div className="relative w-16 h-14 flex items-center justify-center">
                <Shield size={44} className="absolute text-gray-500" strokeWidth={1.2} />
                <span className="relative text-lg font-semibold text-gray-100">{caTotal}</span>
              </div>
              <Label className="text-center">CA</Label>
            </div>
          </div>
          <div className="flex justify-center gap-4 -mt-3 flex-wrap">
            <div className="flex items-center gap-1 text-[10px] text-zinc-600">
              <span>CA = 10 + DES +</span>
              <input
                type="number"
                value={char.caExtra}
                onChange={(e) => setChar((c) => ({ ...c, caExtra: Number(e.target.value) }))}
                className="w-8 bg-transparent border-b border-zinc-800 text-center focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-1 text-[10px] text-zinc-600">
              <span>Bônus de Escudo</span>
              <input
                type="number"
                value={char.caEscudo}
                onChange={(e) => setChar((c) => ({ ...c, caEscudo: Number(e.target.value) }))}
                className="w-8 bg-transparent border-b border-zinc-800 text-center focus:outline-none"
              />
            </div>
          </div>

          <StatusBar
            label="Vida"
            icon={Heart}
            cur={char.hp.cur}
            max={char.hp.max}
            from="from-red-950/60 to-red-950/20"
            to="from-red-800 to-red-600"
            onChange={(patch) => setChar((c) => ({ ...c, hp: { ...c.hp, ...patch } }))}
          />
          <div className="flex items-center justify-center gap-5 -mt-2 text-[10px] text-zinc-600">
            <div className="flex items-center gap-1.5">
              <span className="uppercase tracking-[0.1em]">PV Temp.</span>
              <input
                type="number"
                value={char.hp.temp}
                onChange={(e) => setChar((c) => ({ ...c, hp: { ...c.hp, temp: Number(e.target.value) } }))}
                className="w-9 bg-transparent border-b border-zinc-800 text-center focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="uppercase tracking-[0.1em]">Dados de Vida</span>
              <input
                value={char.hitDice}
                onChange={(e) => setChar((c) => ({ ...c, hitDice: e.target.value }))}
                className="w-12 bg-transparent border-b border-zinc-800 text-center focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <Label>Morte</Label>
              {["success", "fail"].map((k) => (
                <div key={k} className="flex items-center gap-0.5">
                  {[0, 1, 2].map((i) => (
                    <button
                      key={i}
                      onClick={() =>
                        setChar((c) => ({
                          ...c,
                          deathSaves: { ...c.deathSaves, [k]: c.deathSaves[k] === i + 1 ? i : i + 1 },
                        }))
                      }
                      className={`w-2.5 h-2.5 rounded-full border ${
                        char.deathSaves[k] > i
                          ? k === "success"
                            ? "bg-emerald-500 border-emerald-500"
                            : "bg-red-600 border-red-600"
                          : "bg-transparent border-zinc-700"
                      }`}
                    />
                  ))}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Label>Exaustão</Label>
              <div className="flex items-center gap-0.5">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <button
                    key={i}
                    onClick={() => setChar((c) => ({ ...c, exhaustion: c.exhaustion === i + 1 ? i : i + 1 }))}
                    className={`w-2.5 h-2.5 rounded-full border ${
                      char.exhaustion > i ? "bg-amber-500 border-amber-500" : "bg-transparent border-zinc-700"
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between px-1 text-[10px] text-zinc-600">
            <span className="uppercase tracking-[0.1em]">Pontos de Experiência</span>
            <input
              type="number"
              value={char.xp}
              onChange={(e) => setChar((c) => ({ ...c, xp: Number(e.target.value) }))}
              className="w-16 bg-transparent border-b border-zinc-800 text-center text-gray-300 focus:outline-none"
            />
          </div>

          <StatusBar
            label={char.magia.label || "Pontos de Mana"}
            icon={Sparkles}
            cur={char.magia.cur}
            max={char.magia.max}
            from="from-violet-950/60 to-violet-950/20"
            to="from-violet-700 to-cyan-500"
            editableLabel
            onChange={(patch) => setChar((c) => ({ ...c, magia: { ...c.magia, ...patch } }))}
          />

          <div className="space-y-3 pt-1">
            <div>
              <Label>Resistências / Imunidades</Label>
              <Underline value={char.resistencias} onChange={(v) => setChar((c) => ({ ...c, resistencias: v }))} placeholder="—" />
            </div>
            <div>
              <Label>Proficiências (armas / armaduras)</Label>
              <Underline
                value={char.proficienciasArmas}
                onChange={(v) => setChar((c) => ({ ...c, proficienciasArmas: v }))}
                placeholder="—"
              />
            </div>
            <div>
              <Label>Idiomas e Ofícios</Label>
              <Underline value={char.linguas} onChange={(v) => setChar((c) => ({ ...c, linguas: v }))} placeholder="—" />
            </div>
          </div>
        </div>

        {/* -------- COLUNA 2 · CENTRO: salva-guardas + perícias -------- */}
        <div className="col-span-1 md:col-span-4 flex flex-col md:border-l md:border-zinc-900 md:pl-6">
          <h2 className="text-xs tracking-[0.25em] uppercase text-gray-400 mb-3 font-medium">Salva-Guardas</h2>
          <div className="grid grid-cols-3 gap-x-4 gap-y-2 mb-6 pb-5 border-b border-dotted border-zinc-800">
            {ATTRS.map((a) => {
              const trained = !!char.savesTreino[a.key];
              const m = mod(char.attrs[a.key].score) + (trained ? prof : 0);
              return (
                <div key={a.key} className="flex items-center gap-2">
                  <button
                    onClick={() => toggleSaveTreino(a.key)}
                    className={`w-2.5 h-2.5 rounded-full border shrink-0 ${
                      trained ? "bg-red-700 border-red-700" : "bg-transparent border-zinc-700"
                    }`}
                  />
                  <RollIcon size={12} onClick={() => doRoll(`Salvaguarda de ${a.label}`, m)} />
                  <span className="text-xs text-gray-400">{a.short}</span>
                  <span className="text-sm font-semibold ml-auto text-gray-100">{fmtMod(m)}</span>
                </div>
              );
            })}
          </div>

          <h2 className="text-xs tracking-[0.25em] uppercase text-gray-400 mb-3 font-medium">Perícias</h2>
          <div className="flex items-center justify-between px-1 pb-1.5 mb-1 border-b border-zinc-800 text-[9px] tracking-[0.15em] uppercase text-zinc-600">
            <span className="flex-1">Perícia</span>
            <span className="w-10 text-center">Atrib.</span>
            <span className="w-12 text-center">Bônus</span>
            <span className="w-14 text-center">Prof.</span>
            <span className="w-10 text-center">Outros</span>
          </div>
          <div>
            {SKILLS.map((s) => {
              const trained = !!char.skillsTreino[s.name];
              const outros = Number(char.skillsOutros[s.name] || 0);
              const bonus = mod(char.attrs[s.attr].score) + (trained ? prof : 0) + outros;
              return (
                <div
                  key={s.name}
                  className="flex items-center justify-between px-1 py-1.5 border-b border-dotted border-zinc-900 hover:bg-white/[0.02]"
                >
                  <span className="flex-1 flex items-center gap-1.5 min-w-0">
                    <RollIcon size={13} onClick={() => doRoll(s.name, bonus)} />
                    <span className={`text-sm truncate ${trained ? "text-emerald-400" : "text-gray-300"}`}>{s.name}</span>
                  </span>
                  <span className="w-10 text-center text-[10px] text-zinc-500">
                    {ATTRS.find((a) => a.key === s.attr).short}
                  </span>
                  <span className="w-12 text-center text-sm font-semibold text-gray-100">{fmtMod(bonus)}</span>
                  <span className="w-14 flex justify-center">
                    <button onClick={() => toggleSkillTreino(s.name)}>
                      <div
                        className={`w-3.5 h-3.5 rounded-full border ${
                          trained ? "bg-red-700 border-red-700" : "bg-transparent border-zinc-700"
                        }`}
                      />
                    </button>
                  </span>
                  <input
                    type="number"
                    value={char.skillsOutros[s.name] || 0}
                    onChange={(e) => setSkillOutros(s.name, Number(e.target.value))}
                    className="w-10 bg-transparent text-center text-xs text-zinc-500 focus:outline-none focus:text-white"
                  />
                </div>
              );
            })}
          </div>

          <div className="mt-5 pt-4 border-t border-dotted border-zinc-800 grid grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between">
                <Label>Percepção Passiva</Label>
                <span className="text-xl font-bold text-gray-100">{passivaPercepcao}</span>
              </div>
              <div className="flex justify-end mt-0.5">
                <ExtraBonus value={ex.percepcao} onChange={(v) => setExtra("percepcao", v)} />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label>Intuição Passiva</Label>
                <span className="text-xl font-bold text-gray-100">{passivaIntuicao}</span>
              </div>
              <div className="flex justify-end mt-0.5">
                <ExtraBonus value={ex.intuicao} onChange={(v) => setExtra("intuicao", v)} />
              </div>
            </div>
          </div>
        </div>

        {/* -------- COLUNA 3 · DIREITA: abas + combate/inventário -------- */}
        <div className="col-span-1 md:col-span-4 flex flex-col md:border-l md:border-zinc-900 md:pl-6">
          <nav className="flex items-center gap-5 border-b border-zinc-900 pb-2.5 mb-4 overflow-x-auto">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = tab === t.name;
              return (
                <button
                  key={t.name}
                  onClick={() => setTab(t.name)}
                  className={`flex items-center gap-1.5 pb-2 text-[11px] tracking-[0.1em] uppercase whitespace-nowrap border-b-2 transition-colors ${
                    active ? "text-violet-400 border-violet-500" : "text-gray-600 border-transparent hover:text-gray-400"
                  }`}
                >
                  <Icon size={13} strokeWidth={1.8} />
                  {t.name}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-2 mb-4">
            <div className="flex-1 relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-600" />
              <input
                value={char.freeRoll}
                onChange={(e) => setChar((c) => ({ ...c, freeRoll: e.target.value }))}
                placeholder="Rolar dados (ex: +3)"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-md pl-8 pr-3 py-2 text-xs text-gray-200 placeholder:text-zinc-600 focus:outline-none focus:border-red-800"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const m = parseInt(char.freeRoll.replace(/[^-\d]/g, ""), 10) || 0;
                    doRoll(char.freeRoll || "Rolagem livre", m);
                  }
                }}
              />
            </div>
            <RollIcon
              onClick={() => {
                const m = parseInt(char.freeRoll.replace(/[^-\d]/g, ""), 10) || 0;
                doRoll(char.freeRoll || "Rolagem livre", m);
              }}
            />
          </div>

          {tab === "Combate" && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="flex-1 relative">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-600" />
                  <input
                    value={char.attackFilter}
                    onChange={(e) => setChar((c) => ({ ...c, attackFilter: e.target.value }))}
                    placeholder="Filtrar ataques"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-md pl-8 pr-3 py-2 text-xs text-gray-200 placeholder:text-zinc-600 focus:outline-none focus:border-red-800"
                  />
                </div>
                <button
                  onClick={() =>
                    setChar((c) => ({
                      ...c,
                      attacks: [...c.attacks, { id: uid(), nome: "", bonus: "+0", dano: "", tipo: "", open: true }],
                    }))
                  }
                  className="flex items-center gap-1 px-3 py-2 border border-zinc-800 rounded-md text-[11px] tracking-[0.08em] uppercase text-gray-400 hover:border-red-800 hover:text-white transition-colors whitespace-nowrap"
                >
                  <Plus size={12} /> Arma
                </button>
              </div>
              {filteredAttacks.map((atk) => (
                <WeaponCard
                  key={atk.id}
                  atk={atk}
                  onRoll={() =>
                    doRoll(`Ataque: ${atk.nome || "sem nome"}`, parseInt((atk.bonus || "0").replace(/[^-\d]/g, ""), 10) || 0)
                  }
                  onChange={(next) => setChar((c) => ({ ...c, attacks: c.attacks.map((a) => (a.id === atk.id ? next : a)) }))}
                  onRemove={() => setChar((c) => ({ ...c, attacks: c.attacks.filter((a) => a.id !== atk.id) }))}
                />
              ))}
            </div>
          )}

          {tab === "Magias/Runas" && (
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Magias</Label>
                  <select
                    value={char.magia.attr}
                    onChange={(e) => setChar((c) => ({ ...c, magia: { ...c.magia, attr: e.target.value } }))}
                    className="bg-zinc-950 border border-zinc-800 rounded text-[10px] uppercase tracking-wide text-gray-400 px-1.5 py-1 focus:outline-none focus:border-red-800"
                    title="Atributo de conjuração"
                  >
                    <option value="int">Conjura por INT</option>
                    <option value="sab">Conjura por SAB</option>
                    <option value="car">Conjura por CAR</option>
                  </select>
                </div>
                <EditableList
                  items={char.magias}
                  onChange={(magias) => setChar((c) => ({ ...c, magias }))}
                  addLabel="Nova magia"
                  fields={[
                    { key: "nome", placeholder: "Nome" },
                    { key: "custo", placeholder: "Custo", width: "70px" },
                    { key: "desc", placeholder: "Efeito", area: true },
                  ]}
                />
                <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-dotted border-zinc-800 text-center">
                  <div>
                    <Label className="text-center">Pontos de Mana</Label>
                    <div className="text-sm font-semibold text-gray-100 mt-0.5">
                      {char.magia.cur}/{char.magia.max}
                    </div>
                  </div>
                  <div>
                    <Label className="text-center">CD de Magias</Label>
                    <div className="text-sm font-semibold text-gray-100 mt-0.5">
                      {8 + prof + mod(char.attrs[char.magia.attr].score) + Number(ex.magiaCD || 0)}
                    </div>
                    <div className="flex justify-center mt-0.5">
                      <ExtraBonus value={ex.magiaCD} onChange={(v) => setExtra("magiaCD", v)} />
                    </div>
                  </div>
                  <div>
                    <Label className="text-center">Acerto de Magias</Label>
                    <div className="text-sm font-semibold text-gray-100 mt-0.5">
                      {fmtMod(prof + mod(char.attrs[char.magia.attr].score) + Number(ex.magiaAtk || 0))}
                    </div>
                    <div className="flex justify-center mt-0.5">
                      <ExtraBonus value={ex.magiaAtk} onChange={(v) => setExtra("magiaAtk", v)} />
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <Label className="mb-2">Runas</Label>
                <textarea
                  rows={6}
                  value={char.runas}
                  onChange={(e) => setChar((c) => ({ ...c, runas: e.target.value }))}
                  placeholder="Pulso Rúnico, runas conhecidas e seus efeitos…"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-red-800 resize-y"
                />
                <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-dotted border-zinc-800 text-center">
                  <div>
                    <Label className="text-center">CD de Runas</Label>
                    <div className="text-sm font-semibold text-gray-100 mt-0.5">
                      {8 + prof + halfLevel + Number(ex.runaCD || 0)}
                    </div>
                    <div className="text-[9px] text-zinc-600">8 + prof. + ½ nível</div>
                    <div className="flex justify-center mt-0.5">
                      <ExtraBonus value={ex.runaCD} onChange={(v) => setExtra("runaCD", v)} />
                    </div>
                  </div>
                  <div>
                    <Label className="text-center">Acerto de Runas</Label>
                    <div className="text-sm font-semibold text-gray-100 mt-0.5">
                      {fmtMod(prof + halfLevel + Number(ex.runaAtk || 0))}
                    </div>
                    <div className="text-[9px] text-zinc-600">prof. + ½ nível</div>
                    <div className="flex justify-center mt-0.5">
                      <ExtraBonus value={ex.runaAtk} onChange={(v) => setExtra("runaAtk", v)} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === "Heranças" && (
            <div>
              <Label className="mb-2">Heranças e Aprimoramentos</Label>
              <EditableList
                items={char.habilidades}
                onChange={(habilidades) => setChar((c) => ({ ...c, habilidades }))}
                addLabel="Nova habilidade"
                fields={[
                  { key: "nome", placeholder: "Nome" },
                  { key: "desc", placeholder: "Descrição / efeito", area: true },
                ]}
              />
            </div>
          )}

          {tab === "Inventário" && (
            <div>
              <Label className="mb-2">Moedas</Label>
              <div className="grid grid-cols-4 gap-2 mb-4">
                {["pp", "pe", "po", "pl"].map((k) => (
                  <div key={k} className="text-center">
                    <Label className="text-center">{k.toUpperCase()}</Label>
                    <input
                      type="number"
                      value={char.moedas[k]}
                      onChange={(e) => setChar((c) => ({ ...c, moedas: { ...c.moedas, [k]: Number(e.target.value) } }))}
                      className="w-full bg-transparent border-b border-zinc-800 text-center text-sm py-1 focus:outline-none focus:border-red-800"
                    />
                  </div>
                ))}
              </div>
              <Label className="mb-2">Pertences</Label>
              <EditableList
                items={char.inventario}
                onChange={(inventario) => setChar((c) => ({ ...c, inventario }))}
                addLabel="Novo item"
                fields={[
                  { key: "item", placeholder: "Item" },
                  { key: "qtd", placeholder: "Qtd.", width: "60px" },
                  { key: "notas", placeholder: "Notas" },
                ]}
              />
            </div>
          )}

          {tab === "Anotações" && (
            <div>
              <Label className="mb-2">Anotações Pessoais</Label>
              <textarea
                rows={16}
                value={char.bio}
                onChange={(e) => setChar((c) => ({ ...c, bio: e.target.value }))}
                placeholder="Origem, motivações, ganchos de história, relações…"
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-red-800 resize-y"
              />
            </div>
          )}
        </div>
      </div>

      <DiceModal roll={roll} onClose={() => setRoll(null)} onReroll={reroll} />
    </div>
  );
}
