(function () {
  const C = window.EndfieldCalc;
  const data = C.prepare(window.GAME_DATA);
  const KIND_ORDER = { basic: 0, dive: 1, dash: 2, finisher: 3, battle: 4, combo: 5, ultimate: 6 };
  const STAT_LABEL = {
    Str: "Strength", Agi: "Agility", Wisd: "Intellect", Will: "Will",
    Main: "Main Attribute", Sub: "Secondary Attribute", Atk: "ATK", MaxHp: "HP",
    Defense: "DEF", CriticalRate: "Crit Rate",
    PhysicalAndSpellInflictionEnhance: "Arts Intensity",
    PhysicalDamageIncrease: "Physical DMG", SpellDamageIncrease: "Arts DMG",
    FireAndNaturalDamageIncrease: "Heat and Nature DMG",
    CrystAndPulseDamageIncrease: "Cryo and Electric DMG",
    AllSkillDamageIncrease: "All Skill DMG",
    NormalSkillDamageIncrease: "Battle Skill DMG",
    ComboSkillDamageIncrease: "Combo Skill DMG",
    UltimateSkillDamageIncrease: "Ultimate DMG",
    NormalAttackDamageIncrease: "Basic Attack DMG",
    DamageToBrokenUnitIncrease: "DMG vs Staggered",
    HealOutputIncrease: "Treatment", UltimateSpGainScalar: "Ultimate Gain",
  };

  // Flip this to false to put Reactions back under the ability list.
  var SPLIT_REACTIONS = true;

  const state = normalize(load() || {
    operatorId: "chr_0002_endminm",
    query: "",
    tab: "operator",
    resultsTab: "abilities",
    element: "All",
    classFilter: "All",
    level: 90,
    ranks: { basic: 9, battle: 9, combo: 9, ultimate: 9 },
    weaponId: "",
    weaponLevel: 90,
    potential: 0,
    stat1: 9,
    stat2: 9,
    passiveRank: 4,
    passiveOn: {},
    gear: ["", "", "", ""],
    gear70: true,
    setOn: {},
    team: ["", "", ""],
    teamOn: {},
    teamStacks: {},
    hitOn: {},
    hitStacks: {},
    reactionStacks: { reaction: 4, combustion: 4, shatter: 4, crush: 4, breach: 4 },
    gearSet: "",
    manual: { atkPct: 0, atkFlat: 0, dmg: 0, critRate: 0, critDmg: 0, ai: 0, amp: 0, ampElement: "Physical", sus: 0, taken: 0 },
    enemy: {
      def: 100, res: 0, ignoreRes: 0, staggered: false, finisherTier: "elite",
      link: 0, protect: 0, weakness: 0, vulnerable: 4, infliction: 4,
      corrosion: 0, breach: 0, electrified: 0, reactionElement: "Heat",
    },
  });

  function normalize(saved) {
    saved.gear = (saved.gear || ["", "", "", ""]).slice(0, 4);
    while (saved.gear.length < 4) saved.gear.push("");
    saved.team = (saved.team || ["", "", ""]).slice(0, 3);
    while (saved.team.length < 3) saved.team.push("");
    saved.manual = saved.manual || { atkPct: 0, atkFlat: 0, dmg: 0, critRate: 0, critDmg: 0, ai: 0, amp: 0, ampElement: "Physical", sus: 0, taken: 0 };
    saved.enemy = saved.enemy || {};
    saved.passiveOn = saved.passiveOn || {};
    saved.setOn = saved.setOn || {};
    saved.teamOn = saved.teamOn || {};
    saved.teamStacks = saved.teamStacks || {};
    saved.hitOn = saved.hitOn || {};
    saved.hitStacks = saved.hitStacks || {};
    saved.openGroups = saved.openGroups || {};
    saved.reactionStacks = saved.reactionStacks || { reaction: 4, combustion: 4, shatter: 4, crush: 4, breach: 4 };
    ["reaction", "combustion", "shatter", "crush", "breach"].forEach(function (key) {
      saved.reactionStacks[key] = Math.max(1, Math.min(4, Number(saved.reactionStacks[key]) || 4));
    });
    if (saved.gearSet == null) saved.gearSet = "";
    if (["operator", "weapon", "gear", "team", "enemy"].indexOf(saved.tab) < 0) saved.tab = "operator";
    if (!saved.classFilter) saved.classFilter = "All";
    if (saved.resultsTab !== "reactions") saved.resultsTab = "abilities";
    const fallback = Number(saved.rank) || 9;
    saved.ranks = saved.ranks || {};
    ["basic", "battle", "combo", "ultimate"].forEach(function (key) {
      saved.ranks[key] = Math.max(1, Math.min(12, Number(saved.ranks[key]) || fallback));
    });
    saved.enemy.corrosion = levelOrOff(saved.enemy.corrosion);
    saved.enemy.breach = levelOrOff(saved.enemy.breach);
    saved.enemy.electrified = levelOrOff(saved.enemy.electrified);
    if (!saved.enemy.reactionElement) saved.enemy.reactionElement = "Heat";
    if (!saved.enemy.finisherTier) saved.enemy.finisherTier = "elite";
    if (saved.weaponId && /_ink$/.test(saved.weaponId)) saved.weaponId = saved.weaponId.replace(/_ink$/, "");
    return saved;
  }

  function levelOrOff(value) {
    if (value === true) return 4;
    if (value === false || value == null) return 0;
    return Math.max(0, Math.min(4, Number(value) || 0));
  }

  function operatorIcon(id) { return "https://static.warfarin.wiki/v4/charremoteicon/icon_" + id + ".webp"; }
  function operatorPortrait(id) { return "https://static.warfarin.wiki/v4/characterportrait/" + id + ".webp"; }
  function itemIcon(id) { return "https://static.warfarin.wiki/v4/itemicon/" + id + ".webp"; }

  function rankFor(kind) {
    if (kind === "battle") return state.ranks.battle;
    if (kind === "combo") return state.ranks.combo;
    if (kind === "ultimate") return state.ranks.ultimate;
    return state.ranks.basic;
  }

  function partText(weapon, field, rank) {
    if (!weapon || !weapon[field]) return "";
    const node = C.nodeAt(weapon[field], rank);
    return node ? C.describeParts(node.parts) : "";
  }

  const app = document.getElementById("app");
  let formReady = false;

  function load() {
    try { return JSON.parse(localStorage.getItem("endfield-calc-v1") || "null"); }
    catch (e) { return null; }
  }
  function save() {
    const copy = JSON.parse(JSON.stringify(state));
    delete copy._caps;
    delete copy._passiveOptions;
    localStorage.setItem("endfield-calc-v1", JSON.stringify(copy));
  }

  function el(html) {
    const t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstChild;
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function stars(n) { return "★★★★★★".slice(0, n); }
  function rankName(n) { return n <= 9 ? "Rank " + n : "M" + (n - 9); }
  function skillsOf(id) {
    return (data.skills[id] || []).slice().sort(function (a, b) {
      const ak = KIND_ORDER[a.kind];
      const bk = KIND_ORDER[b.kind];
      const d = (ak === undefined ? 9 : ak) - (bk === undefined ? 9 : bk);
      if (d) return d;
      return a.name.localeCompare(b.name, undefined, { numeric: true });
    });
  }
  function formatStat(s) {
    const name = STAT_LABEL[s.stat] || s.stat;
    const percent = s.mod === 6 || /Increase|CriticalRate|Scalar/.test(s.stat);
    if (s.stat === "AllDamageTakenScalar") return "DMG taken " + (Math.round(s.value * 1000) / 10) + "%";
    if (percent) return name + " +" + (Math.round(s.value * 1000) / 10) + "%";
    return name + " +" + (Math.round(s.value * 10) / 10);
  }
  function setHasGear(setId) {
    return data.gear.some(function (g) {
      var levelOk = !state.gear70 || g.level >= 70;
      if (!levelOk) return false;
      if (setId === "none") return !g.suit;
      return g.suit === setId;
    });
  }
  function pieceMatchesSet(g) {
    if (!state.gearSet) return true;
    if (state.gearSet === "none") return !g.suit;
    return g.suit === state.gearSet;
  }
  function gearLabel(g) {
    const set = data.setsById[g.suit];
    const bits = g.stats.map(formatStat).filter(Boolean).join(", ");
    return "Lv " + g.level + " · " + ((set && set.name) || "No set") + " · " + bits;
  }
  function defaultInclude(row) {
    if (!row.damage) return false;
    if (/during|while|after |when |shatter|additional|bonus/i.test(row.label)) return false;
    return true;
  }

  function syncCaps() {
    const probe = Object.assign({}, state, { passiveOn: state.passiveOn, setOn: state.setOn, extraLines: [] });
    C.buildStats(data, probe);
    state._caps = probe._caps;
    state._passiveOptions = probe._passiveOptions || [];
    state.stat1 = Math.min(state.stat1 || probe._caps.stat1, probe._caps.stat1);
    state.stat2 = Math.min(state.stat2 || probe._caps.stat2, probe._caps.stat2);
    state.passiveRank = Math.min(state.passiveRank || probe._caps.passive, probe._caps.passive);
  }

  function currentEnemy() {
    const res = {};
    C.ELEMENTS.forEach(function (name) { res[name] = Number(state.enemy.res) || 0; });
    return {
      def: Number(state.enemy.def) || 0,
      ignoreRes: Number(state.enemy.ignoreRes) || 0,
      staggered: !!state.enemy.staggered,
      finisherTier: state.enemy.finisherTier,
      link: Number(state.enemy.link) || 0,
      protect: (Number(state.enemy.protect) || 0) / 100,
      weakness: (Number(state.enemy.weakness) || 0) / 100,
      sus: (Number(state.manual.sus) || 0) / 100,
      reactionStacks: state.reactionStacks,
      corrosionLevel: Number(state.enemy.corrosion) || 0,
      breachLevel: Number(state.enemy.breach) || 0,
      electroLevel: Number(state.enemy.electrified) || 0,
      reactionElement: state.enemy.reactionElement,
      resFor: function (element) { return res[element] || 0; },
    };
  }

  function extraLines() {
    const lines = [];
    state.team.forEach(function (id) {
      if (!id) return;
      const op = data.operatorsById[id];
      skillsOf(id).forEach(function (skill) {
        if (skill.kind !== "battle" && skill.kind !== "combo" && skill.kind !== "ultimate") return;
        const lv = C.skillRank(skill, rankFor(skill.kind));
        lv.rows.forEach(function (row, index) {
          if (row.damage || row.unit !== "pct") return;
          const buff = classifyBuff(row.label);
          if (!buff) return;
          const key = id + ":" + skill.id + ":" + index;
          lines.push({
            key: key,
            on: !!state.teamOn[key],
            stat: buff,
            value: row.value,
            stacks: state.teamStacks[key] || 1,
            label: op.name + " · " + skill.name + " · " + row.label,
            per: row.per,
          });
        });
      });
    });
    return lines;
  }

  function classifyBuff(label) {
    const l = label.toLowerCase();
    if (/duration|stagger|cooldown|energy|treatment|heal|shield|sp\b|cost/.test(l)) return null;
    if (/arts intensity/.test(l)) return "ai";
    if (/critical rate|crit rate/.test(l)) return "critRate";
    if (/critical dmg|crit dmg/.test(l)) return "critDmg";
    if (/suscept/.test(l)) return "sus";
    if (/\bamp\b/.test(l)) return "amp";
    if (/basic attack|batk/.test(l) && /dmg|damage/.test(l)) return "basic";
    if (/battle skill/.test(l) && /dmg|damage/.test(l)) return "battle";
    if (/combo/.test(l) && /dmg|damage/.test(l)) return "combo";
    if (/ultimate/.test(l) && /dmg|damage/.test(l)) return "ultimate";
    if (/all skill/.test(l)) return "allSkill";
    if (/physical dmg/.test(l)) return "physical";
    if (/heat dmg|fire dmg/.test(l)) return "heat";
    if (/electric dmg|pulse dmg/.test(l)) return "electric";
    if (/cryo dmg|cryst dmg/.test(l)) return "cryo";
    if (/nature dmg/.test(l)) return "nature";
    if (/arts dmg|spell dmg/.test(l)) return "arts";
    if (/dmg dealt|damage dealt|dmg bonus/.test(l)) return "dmg";
    if (/\batk\b/.test(l)) return "atkPct";
    return null;
  }

  function compute() {
    syncCaps();
    const lines = extraLines();
    const clean = C.buildStats(data, {
      operatorId: state.operatorId,
      level: state.level,
      weaponId: state.weaponId,
      weaponLevel: state.weaponLevel,
      potential: state.potential,
      stat1: state.stat1,
      stat2: state.stat2,
      passiveRank: state.passiveRank,
      passiveOn: state.passiveOn,
      gear: state.gear,
      setOn: normalizeSet(state.setOn),
      manual: state.manual,
      extraLines: lines.filter(function (line) { return line.stat !== "sus" && line.stat !== "amp"; }).map(function (line) {
        return { on: line.on, stat: line.stat, value: line.value, stacks: line.per ? line.stacks : 1 };
      }),
    });
    lines.forEach(function (line) {
      if (!line.on) return;
      const count = line.per ? line.stacks : 1;
      if (line.stat === "sus") C.ELEMENTS.forEach(function (name) { clean.bag.sus[name] += line.value * count; });
      if (line.stat === "amp") {
        const element = elementFromLabel(line.label) || data.operatorsById[state.operatorId].element;
        if (element === "Arts") C.ELEMENTS.forEach(function (name) { if (name !== "Physical") clean.bag.amp[name] += line.value * count; });
        else clean.bag.amp[element] += line.value * count;
      }
    });
    state._caps = clean.caps;
    state._passiveOptions = clean.passiveOptions || [];
    const enemy = currentEnemy();
    const mods = C.statusMods(clean, enemy);
    const hits = [];
    skillsOf(state.operatorId).forEach(function (skill) {
      const lv = C.skillRank(skill, rankFor(skill.kind));
      let current = null;
      const seen = {};
      lv.rows.forEach(function (row, index) {
        if (/stagger/i.test(row.label) && current) {
          current.staggerBase = (current.staggerBase || 0) + row.value * (row.per ? current.stacks : 1);
          return;
        }
        if (!row.damage) return;
        const key = skill.id + ":" + index;
        const stacks = state.hitStacks[key] == null ? 1 : state.hitStacks[key];
        const on = state.hitOn[key] == null ? defaultInclude(row) : state.hitOn[key];
        const multiplier = row.value * (row.per ? stacks : 1);
        const struck = C.strike(clean, {
          multiplier: multiplier,
          kind: skill.kind,
          element: clean.op.element,
          canCrit: !/over time|dot/i.test(row.label),
          enemy: enemy,
          taken: (clean.op.element === "Physical" ? mods.breachTaken : mods.electroTaken),
          corrosion: mods.corrosion,
        });
        current = {
          key: key, skill: skill, row: row, on: on, stacks: stacks, result: struck, staggerBase: null,
          form: arcaneForm(skill, row, seen),
        };
        hits.push(current);
      });
    });
    hits.forEach(function (hit) {
      if (hit.staggerBase == null) return;
      hit.stagger = hit.staggerBase * (1 + (clean.bag.staggerEff || 0));
    });
    (clean.setHits || []).forEach(function (extra) {
      const struck = C.strike(clean, {
        multiplier: extra.multiplier,
        kind: "set",
        element: extra.element,
        canCrit: true,
        enemy: enemy,
        taken: extra.element === "Physical" ? mods.breachTaken : mods.electroTaken,
        corrosion: mods.corrosion,
      });
      const key = "set:" + extra.key;
      hits.push({
        key: key,
        skill: { id: key, name: extra.name, kind: "set" },
        row: { label: extra.name, value: extra.multiplier, per: false, damage: true },
        on: state.hitOn[key] == null ? true : state.hitOn[key],
        stacks: 1,
        result: struck,
        stagger: extra.stagger ? extra.stagger * (1 + (clean.bag.staggerEff || 0)) : null,
        form: "",
      });
    });
    const reactions = C.reactionHits(clean, enemy);
    return { stats: clean, hits: hits, reactions: reactions, mods: mods, lines: lines };
  }

  function elementFromLabel(label) {
    const l = label.toLowerCase();
    if (/heat|fire/.test(l)) return "Heat";
    if (/electric|pulse/.test(l)) return "Electric";
    if (/cryo|cryst/.test(l)) return "Cryo";
    if (/nature/.test(l)) return "Nature";
    if (/physical/.test(l)) return "Physical";
    if (/arts amp|arts suscept/.test(l)) return "Arts";
    return null;
  }

  function normalizeSet(setOn) {
    const out = {};
    Object.keys(setOn || {}).forEach(function (key) {
      const n = Number(setOn[key]);
      if (n) out[key] = n;
    });
    return out;
  }

  let refocusSearch = false;

  function render() {
    const model = compute();
    const op = data.operatorsById[state.operatorId];
    const weapons = data.weapons.filter(function (w) { return w.type === op.weapon; })
      .sort(function (a, b) { return b.rarity - a.rarity || a.name.localeCompare(b.name); });
    const ops = data.operators.filter(function (item) {
      if (state.element !== "All" && item.element !== state.element) return false;
      if (state.classFilter !== "All" && item.class !== state.classFilter) return false;
      if (state.query && item.name.toLowerCase().indexOf(state.query.toLowerCase()) < 0) return false;
      return true;
    }).sort(function (a, b) { return b.rarity - a.rarity || a.name.localeCompare(b.name); });

    app.innerHTML = "";
    app.appendChild(renderBuilder(op, ops, weapons));
    app.appendChild(renderResults(model));
    formReady = true;
    if (refocusSearch) {
      const q = document.getElementById("q");
      if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
      refocusSearch = false;
    }
    save();
  }

  function renderBuilder(op, ops, weapons) {
    const root = el('<section class="panel builder"></section>');
    root.innerHTML =
      '<div class="side-tabs">' +
        ["operator", "weapon", "gear", "team", "enemy"].map(function (name) {
          const label = name.charAt(0).toUpperCase() + name.slice(1);
          return '<button type="button" data-tab="' + name + '"' + (state.tab === name ? ' class="on"' : "") + ">" + label + "</button>";
        }).join("") +
      "</div>" +
      '<div class="tab-panel" data-panel="operator">' +
      '<div class="field"><label for="q">Search</label><input id="q" value="' + escapeHtml(state.query) + '" placeholder="Name"></div>' +
      '<div class="filters" id="elements"></div>' +
      '<div class="filters" id="classes"></div>' +
      '<div class="op-list" id="ops"></div>' +
      '<div class="field" style="margin-top:12px"><label for="level">Level</label><input id="level" type="number" min="1" max="90" value="' + state.level + '"></div>' +
      "<h3>Skill levels</h3>" +
      '<p class="hint">Basic Attack also covers the dive, dash, and finisher. Each of the four skills can sit at its own rank.</p>' +
      skillControls(op.id) +
      "</div>" +
      '<div class="tab-panel" data-panel="weapon">' +
      '<div class="pick-list" id="weapons"></div>' +
      weaponStatFields(weapons) +
      '<div id="passive"></div>' +
      "</div>" +
      '<div class="tab-panel" data-panel="gear">' +
      '<p class="hint">One armor, one pair of gloves, and two kits. Three pieces of a set turn on its bonus.</p>' +
      '<label class="check"><input id="g70" type="checkbox"' + (state.gear70 ? " checked" : "") + "> Show level 70 gear only</label>" +
      '<div class="field"><label for="gearset">Set</label><select id="gearset"><option value="">All pieces</option>' +
        (setHasGear("none") ? '<option value="none"' + (state.gearSet === "none" ? " selected" : "") + ">No set effect</option>" : "") +
        data.sets.filter(function (set) { return setHasGear(set.id); }).sort(function (a, b) { return a.name.localeCompare(b.name); }).map(function (set) {
          return '<option value="' + set.id + '"' + (state.gearSet === set.id ? " selected" : "") + ">" + escapeHtml(set.name) + "</option>";
        }).join("") + "</select></div>" +
      '<p class="hint">Choose a set to list only its pieces.</p>' +
      gearSelect("Armor", 0) + gearSelect("Gloves", 1) + gearSelect("Kit", 2) + gearSelect("Kit", 3) +
      '<div id="sets"></div>' +
      "</div>" +
      '<div class="tab-panel" data-panel="team">' +
      '<p class="hint">A teammate does not add damage by themselves. Their percent buffs are listed under the team so you can turn on the ones that are active.</p>' +
      teamSelect(0) + teamSelect(1) + teamSelect(2) +
      '<div id="team-buffs"></div>' +
      "</div>" +
      '<div class="tab-panel" data-panel="enemy">' +
      "<h3>Extra bonuses</h3>" +
      '<div class="grid-2">' +
        numField("atkPct", "ATK %", state.manual.atkPct) +
        numField("atkFlat", "Flat ATK", state.manual.atkFlat) +
        numField("dmg", "DMG bonus %", state.manual.dmg) +
        numField("ai", "Arts Intensity", state.manual.ai) +
        numField("critRate", "Crit Rate %", state.manual.critRate) +
        numField("critDmg", "Crit DMG %", state.manual.critDmg) +
        numField("amp", "Amp %", state.manual.amp) +
        numField("sus", "Susceptibility %", state.manual.sus) +
        numField("taken", "DMG taken %", state.manual.taken) +
      "</div>" +
      '<div class="field"><label for="ampEl">Amp element</label><select id="ampEl">' +
        C.ELEMENTS.map(function (name) {
          return '<option' + (state.manual.ampElement === name ? " selected" : "") + ">" + name + "</option>";
        }).join("") + "</select></div>" +
      "<h3>Enemy</h3>" +
      '<div class="grid-3">' +
        numField("def", "DEF", state.enemy.def, true) +
        numField("res", "Resistance", state.enemy.res, true) +
        numField("ignore", "Ignore RES", state.enemy.ignoreRes, true) +
      "</div>" +
      '<div class="field">' + numField("link", "Link stacks", state.enemy.link, true) + "</div>" +
      '<div class="grid-2">' +
        numField("weak", "Weakness %", state.enemy.weakness, true) +
        numField("prot", "Protection %", state.enemy.protect, true) +
      "</div>" +
      '<div class="field"><label for="tier">Finisher target</label><select id="tier">' +
        [["common", "Common (×1)"], ["advanced", "Advanced (×1.25)"], ["elite", "Elite / Alpha (×1.5)"], ["boss", "Boss (×1.75)"]].map(function (pair) {
          return '<option value="' + pair[0] + '"' + (state.enemy.finisherTier === pair[0] ? " selected" : "") + ">" + pair[1] + "</option>";
        }).join("") + "</select></div>" +
      '<div class="field"><label for="react">Reaction element</label><select id="react">' +
        ["Heat", "Electric", "Cryo", "Nature"].map(function (name) {
          return '<option' + (state.enemy.reactionElement === name ? " selected" : "") + ">" + name + "</option>";
        }).join("") + "</select>" +
      '<p class="hint">This does not change the operator\'s own skills. Those always use the operator\'s element. It only sets the element of the generic Arts Reaction and Arts Burst rows: which resistance they check, and which elemental damage bonus applies. Combustion is always Heat. Shatter, Crush, Breach damage, and Lift are always Physical. Choose the reaction you are actually triggering. A Heat operator who applies Solidification should pick Cryo.</p></div>' +
      '<label class="check"><input id="stag" type="checkbox"' + (state.enemy.staggered ? " checked" : "") + "> Enemy is staggered (damage ×1.3, and the finisher uses the target tier)</label>" +
      levelSelect("corr", "Corrosion", state.enemy.corrosion, ["12 resistance", "16 resistance", "20 resistance", "24 resistance"]) +
      levelSelect("br", "Breach", state.enemy.breach, ["+12% Physical DMG taken", "+16% Physical DMG taken", "+20% Physical DMG taken", "+24% Physical DMG taken"]) +
      levelSelect("elec", "Electrification", state.enemy.electrified, ["+12% Arts DMG taken", "+16% Arts DMG taken", "+20% Arts DMG taken", "+24% Arts DMG taken"]) +
      '<p class="hint">Those three amounts are the base at Arts Intensity 0. The operator\'s Arts Intensity raises them. Infliction stacks above set the Arts Reaction, Burst, and Combustion damage. Vulnerable stacks set Crush, Breach damage, and Lift.</p>' +
      "</div>";

    const filters = root.querySelector("#elements");
    ["All"].concat(C.ELEMENTS).forEach(function (name) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = name;
      if (state.element === name) b.className = "on";
      b.addEventListener("click", function () { state.element = name; render(); });
      filters.appendChild(b);
    });
    const classRow = root.querySelector("#classes");
    const classes = ["All"];
    data.operators.forEach(function (item) {
      if (classes.indexOf(item.class) < 0) classes.push(item.class);
    });
    classes.sort(function (a, b) {
      if (a === "All") return -1;
      if (b === "All") return 1;
      return a.localeCompare(b);
    });
    classes.forEach(function (name) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = name;
      if (state.classFilter === name) b.className = "on";
      b.addEventListener("click", function () { state.classFilter = name; render(); });
      classRow.appendChild(b);
    });
    const list = root.querySelector("#ops");
    ops.forEach(function (item) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "op " + item.element + (item.id === state.operatorId ? " on" : "");
      b.innerHTML = '<img src="' + operatorIcon(item.id) + '" alt="" width="40" height="40">' +
        "<span><strong>" + escapeHtml(item.name) + "</strong><span>" + stars(item.rarity) + " · " + item.element + " · " + item.class + "</span></span>";
      b.addEventListener("click", function () {
        state.operatorId = item.id;
        const match = data.weapons.filter(function (w) { return w.type === item.weapon; });
        const preferred = match.filter(function (w) { return w.id === item.weaponId; })[0] || match[0];
        state.weaponId = preferred ? preferred.id : "";
        state.hitOn = {};
        render();
      });
      list.appendChild(b);
    });
    const weaponBox = root.querySelector("#weapons");
    const none = document.createElement("button");
    none.type = "button";
    none.className = "pick" + (state.weaponId ? "" : " on");
    none.textContent = "No weapon";
    none.addEventListener("click", function () { state.weaponId = ""; state.passiveOn = {}; render(); });
    weaponBox.appendChild(none);
    weapons.forEach(function (w) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "pick" + (w.id === state.weaponId ? " on" : "");
      b.innerHTML = '<img src="' + itemIcon(w.id) + '" alt="" width="36" height="36"><span><strong>' +
        escapeHtml(w.name) + "</strong><span>" + escapeHtml(stars(w.rarity)) + "</span></span>";
      b.addEventListener("click", function () { state.weaponId = w.id; state.passiveOn = {}; render(); });
      weaponBox.appendChild(b);
    });

    applyTab(root);
    root.querySelectorAll("[data-tab]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.tab = btn.dataset.tab;
        applyTab(root);
        save();
      });
    });
    bind(root);
    fillPassive(root);
    fillSets(root);
    fillTeam(root);
    return root;
  }

  function applyTab(root) {
    root.querySelectorAll("[data-panel]").forEach(function (panel) {
      panel.hidden = panel.dataset.panel !== state.tab;
    });
    root.querySelectorAll("[data-tab]").forEach(function (btn) {
      btn.className = btn.dataset.tab === state.tab ? "on" : "";
    });
  }

  function field(label, inner) {
    return '<div class="field"><label>' + label + "</label>" + inner + "</div>";
  }
  function numField(id, label, value, enemy) {
    return '<div class="field"><label for="' + id + '">' + label + '</label><input id="' + id + '" data-enemy="' + (enemy ? "1" : "") + '" type="number" step="any" value="' + value + '"></div>';
  }
  function skillControls(operatorId) {
    const present = {};
    skillsOf(operatorId).forEach(function (skill) { present[skill.kind] = true; });
    const groups = [
      { key: "basic", label: "Basic Attack", show: present.basic || present.dive || present.dash || present.finisher },
      { key: "battle", label: "Battle Skill", show: present.battle },
      { key: "combo", label: "Combo Skill", show: present.combo },
      { key: "ultimate", label: "Ultimate", show: present.ultimate },
    ];
    return groups.filter(function (g) { return g.show; }).map(function (g) {
      const value = state.ranks[g.key];
      return '<div class="skill-row"><span>' + g.label + '</span><input data-rank="' + g.key + '" type="range" min="1" max="12" value="' + value + '"><b>' + rankName(value) + "</b></div>";
    }).join("");
  }
  function weaponStatFields(weapons) {
    const weapon = weapons.filter(function (w) { return w.id === state.weaponId; })[0];
    const caps = state._caps || { stat1: 9, stat2: 9, passive: 9 };
    if (!weapon) return '<p class="hint">Choose a weapon to see its stats.</p>';
    const main = partText(weapon, "stat1", state.stat1) || "No bonus";
    const sub = partText(weapon, "stat2", state.stat2) || "No bonus";
    return '<div class="chosen"><img src="' + itemIcon(weapon.id) + '" alt="" width="48" height="48"><div><strong>' +
      escapeHtml(weapon.name) + "</strong><span>" + escapeHtml(stars(weapon.rarity) + " · " + weapon.type) + "</span></div></div>" +
      '<div class="grid-2">' +
        field("Weapon level", '<input id="wlevel" type="number" min="1" max="90" value="' + state.weaponLevel + '">') +
      "</div>" +
      '<div class="skill-row"><span>' + escapeHtml(main) + '</span><input id="s1" type="range" min="1" max="' + caps.stat1 + '" value="' + state.stat1 + '"><b>' + state.stat1 + "/" + caps.stat1 + "</b></div>" +
      '<div class="skill-row"><span>' + escapeHtml(sub) + '</span><input id="s2" type="range" min="1" max="' + caps.stat2 + '" value="' + state.stat2 + '"><b>' + state.stat2 + "/" + caps.stat2 + "</b></div>" +
      '<div class="skill-row"><span>Passive rank</span><input id="prank" type="range" min="1" max="' + caps.passive + '" value="' + state.passiveRank + '"><b>' + state.passiveRank + "/" + caps.passive + "</b></div>";
  }
  function levelSelect(id, label, value, notes) {
    let html = '<div class="field"><label for="' + id + '">' + label + '</label><select id="' + id + '">';
    html += '<option value="0"' + (Number(value) === 0 ? " selected" : "") + ">Off</option>";
    notes.forEach(function (note, index) {
      const level = index + 1;
      html += '<option value="' + level + '"' + (Number(value) === level ? " selected" : "") + ">Level " + level + " · " + note + "</option>";
    });
    return html + "</select></div>";
  }
  function gearSelect(slot, index) {
    const chosen = data.gearById[state.gear[index]];
    const options = data.gear.filter(function (g) {
      return g.slot === slot && (!state.gear70 || g.level >= 70) && pieceMatchesSet(g);
    }).sort(function (a, b) { return b.level - a.level || gearLabel(a).localeCompare(gearLabel(b)); });
    const preview = chosen
      ? '<div class="chosen"><img src="' + itemIcon(chosen.id) + '" alt="" width="40" height="40"><div><strong>' + escapeHtml(slot) + "</strong><span>" + escapeHtml(gearLabel(chosen)) + "</span></div></div>"
      : "<label>" + slot + "</label>";
    return '<div class="field">' + preview +
      '<div class="pick-list gear-list">' +
      '<button type="button" class="pick' + (state.gear[index] ? "" : " on") + '" data-gear="' + index + '" data-id="">None</button>' +
      options.map(function (g) {
        return '<button type="button" class="pick' + (state.gear[index] === g.id ? " on" : "") + '" data-gear="' + index + '" data-id="' + g.id + '">' +
          '<img src="' + itemIcon(g.id) + '" alt="" width="32" height="32"><span>' + escapeHtml(gearLabel(g)) + "</span></button>";
      }).join("") + "</div></div>";
  }
  function teamSelect(index) {
    const options = data.operators.slice().sort(function (a, b) { return a.name.localeCompare(b.name); });
    const chosen = data.operatorsById[state.team[index]];
    const face = chosen ? '<img src="' + operatorIcon(chosen.id) + '" alt="" width="36" height="36">' : "";
    return '<div class="field"><label>Teammate ' + (index + 1) + '</label><div class="chosen">' + face +
      '<select data-team="' + index + '"><option value="">Empty</option>' +
      options.map(function (op) {
        return '<option value="' + op.id + '"' + (state.team[index] === op.id ? " selected" : "") + ">" +
          escapeHtml(op.name + " · " + op.element) + "</option>";
      }).join("") + "</select></div></div>";
  }

  function bind(root) {
    root.querySelector("#q").addEventListener("input", function (e) { state.query = e.target.value; refocusSearch = true; render(); });
    root.querySelector("#level").addEventListener("input", function (e) { state.level = C.clamp(e.target.value, 1, 90); refreshResults(); });
    root.querySelectorAll("[data-rank]").forEach(function (input) {
      input.addEventListener("input", function () {
        state.ranks[input.dataset.rank] = C.clamp(input.value, 1, 12);
        input.parentNode.querySelector("b").textContent = rankName(state.ranks[input.dataset.rank]);
        refreshResults();
      });
    });
    const wlevel = root.querySelector("#wlevel");
    if (wlevel) {
      wlevel.addEventListener("input", function (e) { state.weaponLevel = C.clamp(e.target.value, 1, 90); refreshResults(); });
      wlevel.addEventListener("change", function () { render(); });
    }
    function slideStat(input, field) {
      if (!input) return;
      input.addEventListener("input", function () {
        const max = Number(input.max) || 9;
        const value = C.clamp(input.value, 1, max);
        if (field === "stat1") state.stat1 = value;
        else if (field === "stat2") state.stat2 = value;
        else state.passiveRank = value;
        input.parentNode.querySelector("b").textContent = value + "/" + max;
        if (field !== "passive") {
          const weapon = data.weaponsById[state.weaponId];
          input.parentNode.querySelector("span").textContent = partText(weapon, field, value) || "No bonus";
        }
        refreshResults();
        if (field === "passive") fillPassive(document);
      });
    }
    slideStat(root.querySelector("#s1"), "stat1");
    slideStat(root.querySelector("#s2"), "stat2");
    slideStat(root.querySelector("#prank"), "passive");
    root.querySelector("#g70").addEventListener("change", function (e) {
      state.gear70 = e.target.checked;
      if (state.gearSet && !setHasGear(state.gearSet)) state.gearSet = "";
      render();
    });
    root.querySelector("#gearset").addEventListener("change", function (e) { state.gearSet = e.target.value; render(); });
    root.querySelectorAll("[data-gear]").forEach(function (button) {
      button.addEventListener("click", function () {
        state.gear[Number(button.dataset.gear)] = button.dataset.id;
        render();
      });
    });
    root.querySelectorAll("[data-team]").forEach(function (sel) {
      sel.addEventListener("change", function () {
        state.team[Number(sel.dataset.team)] = sel.value;
        render();
      });
    });
    ["atkPct", "atkFlat", "dmg", "ai", "critRate", "critDmg", "amp", "sus", "taken"].forEach(function (id) {
      root.querySelector("#" + id).addEventListener("input", function (e) {
        state.manual[id] = Number(e.target.value) || 0;
        refreshResults();
      });
    });
    root.querySelector("#ampEl").addEventListener("change", function (e) { state.manual.ampElement = e.target.value; refreshResults(); });
    const enemyMap = { def: "def", res: "res", ignore: "ignoreRes", link: "link", weak: "weakness", prot: "protect" };
    Object.keys(enemyMap).forEach(function (id) {
      root.querySelector("#" + id).addEventListener("input", function (e) {
        state.enemy[enemyMap[id]] = Number(e.target.value) || 0;
        refreshResults();
      });
    });
    root.querySelector("#tier").addEventListener("change", function (e) { state.enemy.finisherTier = e.target.value; refreshResults(); });
    root.querySelector("#react").addEventListener("change", function (e) { state.enemy.reactionElement = e.target.value; refreshResults(); });
    root.querySelector("#stag").addEventListener("change", function (e) { state.enemy.staggered = e.target.checked; refreshResults(); });
    root.querySelector("#corr").addEventListener("change", function (e) { state.enemy.corrosion = Number(e.target.value) || 0; refreshResults(); });
    root.querySelector("#br").addEventListener("change", function (e) { state.enemy.breach = Number(e.target.value) || 0; refreshResults(); });
    root.querySelector("#elec").addEventListener("change", function (e) { state.enemy.electrified = Number(e.target.value) || 0; refreshResults(); });
  }

  function fillPassive(root) {
    const box = root.querySelector("#passive");
    const options = state._passiveOptions || [];
    if (!options.length) {
      box.innerHTML = '<p class="hint">This weapon has no passive.</p>';
      return;
    }
    box.innerHTML = '<div class="passive-copy">' + options.map(function (opt) {
      const on = !!state.passiveOn[opt.id];
      return '<label class="check"><input type="checkbox" data-passive="' + escapeHtml(opt.id) + '"' + (on ? " checked" : "") + "> " + escapeHtml(opt.label) + "</label>";
    }).join("") + '<p class="hint">These are the passive lines at the rank above. A tick counts that line in the damage. The numbers move when you change the rank.</p></div>';
    box.querySelectorAll("[data-passive]").forEach(function (input) {
      input.addEventListener("change", function () {
        state.passiveOn[input.dataset.passive] = input.checked;
        refreshResults();
      });
    });
  }

  function fillSets(root) {
    const box = root.querySelector("#sets");
    const counts = {};
    state.gear.forEach(function (id) {
      const g = data.gearById[id];
      if (g && g.suit) counts[g.suit] = (counts[g.suit] || 0) + 1;
    });
    const active = Object.keys(counts).filter(function (id) { return counts[id] >= 3; });
    if (!active.length) {
      box.innerHTML = '<p class="hint">Equip three pieces from one set to add its bonus.</p>';
      return;
    }
    box.innerHTML = active.map(function (id) {
      const bonus = C.SET_BONUSES[id];
      const name = (data.setsById[id] && data.setsById[id].name) || id;
      if (!bonus) return '<p class="hint">' + escapeHtml(name) + " is equipped. Its conditional bonus is not coded yet, so add it under extra bonuses.</p>";
      const always = bonus.text ? escapeHtml(bonus.text) : bonus.always.map(function (line) { return escapeHtml(line.label); }).join(", ");
      const options = (bonus.options || []).map(function (opt) {
        const key = id + ":" + opt.id;
        if (opt.max) {
          return '<div class="field"><label>' + escapeHtml(opt.label) + '</label><input data-set="' + key + '" type="number" min="0" max="' + opt.max + '" value="' + (state.setOn[key] || 0) + '"></div>';
        }
        const on = !!state.setOn[key];
        return '<label class="check"><input data-set="' + key + '" type="checkbox"' + (on ? " checked" : "") + "> " + escapeHtml(opt.label) + "</label>";
      }).join("");
      return '<div class="set-copy"><strong>' + escapeHtml(name) + "</strong><p>" + always + "</p>" + options + "</div>";
    }).join("");
    box.querySelectorAll("[data-set]").forEach(function (input) {
      input.addEventListener("input", function () {
        state.setOn[input.dataset.set] = input.type === "checkbox" ? (input.checked ? 1 : 0) : Number(input.value) || 0;
        refreshResults();
      });
      input.addEventListener("change", function () {
        state.setOn[input.dataset.set] = input.type === "checkbox" ? (input.checked ? 1 : 0) : Number(input.value) || 0;
        refreshResults();
      });
    });
  }

  function fillTeam(root) {
    const box = root.querySelector("#team-buffs");
    const lines = extraLines();
    if (!lines.length) {
      box.innerHTML = "";
      return;
    }
    box.innerHTML = lines.map(function (line) {
      const stack = line.per ? '<input data-tstack="' + escapeHtml(line.key) + '" type="number" min="0" max="8" value="' + line.stacks + '" style="width:64px">' : "";
      return '<label class="check"><input data-teamon="' + escapeHtml(line.key) + '" type="checkbox"' + (line.on ? " checked" : "") + "> " +
        escapeHtml(line.label) + " (" + C.pct(line.value) + ")</label>" + stack;
    }).join("");
    box.querySelectorAll("[data-teamon]").forEach(function (input) {
      input.addEventListener("change", function () {
        state.teamOn[input.dataset.teamon] = input.checked;
        refreshResults();
      });
    });
    box.querySelectorAll("[data-tstack]").forEach(function (input) {
      input.addEventListener("input", function () {
        state.teamStacks[input.dataset.tstack] = Number(input.value) || 0;
        refreshResults();
      });
    });
  }

  function refreshResults() {
    if (!formReady) return;
    const old = app.querySelector(".results");
    const next = renderResults(compute());
    if (old) old.replaceWith(next);
    else app.appendChild(next);
    save();
  }

  function renderResults(model) {
    const stats = model.stats;
    const root = el('<section class="panel results"></section>');
    const test = C.selfTest(data);
    const banner = test.ok ? "" : '<div class="banner">Formula check failed. ' + escapeHtml(test.detail || "") + "</div>";
    const included = model.hits.filter(function (h) { return h.on; });
    const sum = included.reduce(function (acc, h) {
      acc.noncrit += h.result.noncrit;
      acc.crit += h.result.crit;
      acc.average += h.result.average;
      return acc;
    }, { noncrit: 0, crit: 0, average: 0 });

    root.innerHTML = banner +
      '<div class="who"><img class="portrait" src="' + operatorPortrait(stats.op.id) + '" alt="">' +
      "<div><h2>" + escapeHtml(stats.op.name) + "</h2>" +
      '<p class="hint">' + escapeHtml(stars(stats.op.rarity) + " " + stats.op.element + " " + stats.op.class + " · " + stats.op.weapon + " · " + stats.op.main + " / " + stats.op.sub) + "</p></div></div>" +
      '<div class="stats">' +
        statBox(stats.screenAtk, "Screen ATK") +
        statBox(Math.round(stats.critRate * 1000) / 10 + "%", "Crit rate") +
        statBox(Math.round(stats.critDmg * 1000) / 10 + "%", "Crit DMG") +
        statBox(Math.round(stats.ai * 10) / 10, "Arts intensity") +
      "</div>" +
      '<p class="hint">Screen ATK is floored. Damage uses the exact attack (' + Math.round(stats.attack * 10) / 10 + "), then each hit is floored. Main " +
        stats.op.main + " " + Math.floor(stats.main) + ", secondary " + stats.op.sub + " " + Math.floor(stats.sub) +
        ". Attribute bonus ×" + (Math.round(stats.attributeBonus * 1000) / 1000) + ".</p>" +
      (stats.notes.length ? "<ul class='notes'>" + stats.notes.map(function (n) { return "<li>" + escapeHtml(n) + "</li>"; }).join("") + "</ul>" : "") +
      resultTabs(model);

    const menus = root.querySelector("#hit-menus");
    groupHits(model.hits).forEach(function (group) {
      const checked = group.hits.filter(function (hit) { return hit.on; });
      const groupSum = checked.reduce(function (acc, hit) {
        acc.noncrit += hit.result.noncrit;
        acc.average += hit.result.average;
        return acc;
      }, { noncrit: 0, average: 0 });
      const details = document.createElement("details");
      details.className = "menu";
      details.open = state.openGroups[group.key] !== false;
      const rankBit = group.key === "set" ? "" : " · " + rankName(rankFor(group.key));
      details.innerHTML = "<summary>" + escapeHtml(group.label) + rankBit +
        "<span>" + group.hits.length + " hits · " + groupSum.noncrit.toLocaleString() + " checked</span></summary>";
      const table = document.createElement("table");
      table.innerHTML = "<thead><tr><th></th><th>Hit</th><th class='num'>Rate</th><th class='num'>Hit</th><th class='num'>Crit</th><th class='num'>Average</th></tr></thead>";
      const body = document.createElement("tbody");
      let lastName = "";
      group.hits.forEach(function (hit) {
        if (group.manyNames && hit.skill.name !== lastName) {
          const head = document.createElement("tr");
          head.className = "subhead";
          head.innerHTML = "<td colspan='6'>" + escapeHtml(skillTitle(hit.skill)) + "</td>";
          body.appendChild(head);
          lastName = hit.skill.name;
        }
        const tr = document.createElement("tr");
        if (!hit.on) tr.className = "row-off";
        const stackInput = hit.row.per
          ? ' <input data-hstack="' + hit.key + '" type="number" min="0" max="12" value="' + hit.stacks + '" style="width:56px">'
          : "";
        tr.innerHTML =
          "<td><input data-hit='" + hit.key + "' type='checkbox'" + (hit.on ? " checked" : "") + "></td>" +
          "<td>" + (hit.form ? '<div class="form-tag">' + escapeHtml(hit.form) + "</div>" : "") + escapeHtml(hitLabel(hit)) + stackInput + staggerNote(hit.stagger) + "</td>" +
          "<td class='num'>" + C.pct(hit.row.value * (hit.row.per ? hit.stacks : 1)) + "</td>" +
          "<td class='num'>" + hit.result.noncrit.toLocaleString() + "</td>" +
          "<td class='num'>" + (hit.result.canCrit === false ? "—" : hit.result.crit.toLocaleString()) + "</td>" +
          "<td class='num'>" + hit.result.average.toLocaleString() + "</td>";
        body.appendChild(tr);
      });
      table.appendChild(body);
      details.appendChild(table);
      details.addEventListener("toggle", function () { state.openGroups[group.key] = details.open; });
      menus.appendChild(details);
    });
    const total = document.createElement("tr");
    total.className = "total";
    total.innerHTML = "<td>Checked hits</td><td class='num'>" + sum.noncrit.toLocaleString() +
      "</td><td class='num'>" + sum.crit.toLocaleString() + "</td><td class='num'>" + sum.average.toLocaleString() + "</td>";
    root.querySelector("#hit-total").appendChild(total);
    root.querySelectorAll("[data-hit]").forEach(function (input) {
      input.addEventListener("change", function () {
        state.hitOn[input.dataset.hit] = input.checked;
        refreshResults();
      });
    });
    root.querySelectorAll("[data-hstack]").forEach(function (input) {
      input.addEventListener("input", function () {
        state.hitStacks[input.dataset.hstack] = Number(input.value) || 0;
        refreshResults();
      });
    });
    root.querySelectorAll("[data-result]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.resultsTab = btn.dataset.result;
        applyResultTab(root);
        save();
      });
    });
    applyResultTab(root);
    const reaction = root.querySelector("#reactions");
    if (reaction) {
      reaction.open = state.openGroups.reactions !== false;
      reaction.addEventListener("toggle", function () { state.openGroups.reactions = reaction.open; });
    }
    root.querySelectorAll("[data-rstack]").forEach(function (input) {
      input.addEventListener("input", function () {
        state.reactionStacks[input.dataset.rstack] = C.clamp(input.value, 1, 4);
        refreshResults();
      });
    });
    return root;
  }

  function resultTabs(model) {
    var abilities = "<h3>Abilities</h3>" +
      '<p class="hint">Hits from the same skill sit in one menu. Basic Attack includes the sequence, dive, dash, and finisher, matching the in-game panel. Uncheck a row if that hit is not part of the sequence you are comparing.</p>' +
      '<div id="hit-menus"></div>' +
      '<table><tbody id="hit-total"></tbody></table>';
    var reactions = reactionBody(model);
    if (!SPLIT_REACTIONS) return abilities + reactions;
    var onAbilities = state.resultsTab !== "reactions";
    return '<div class="side-tabs result-tabs">' +
      '<button type="button" data-result="abilities"' + (onAbilities ? ' class="on"' : "") + ">Abilities</button>" +
      '<button type="button" data-result="reactions"' + (!onAbilities ? ' class="on"' : "") + ">Reactions</button>" +
      "</div>" +
      '<div class="tab-panel" data-result-panel="abilities"' + (onAbilities ? "" : " hidden") + ">" + abilities + "</div>" +
      '<div class="tab-panel" data-result-panel="reactions"' + (onAbilities ? " hidden" : "") + ">" + reactions + "</div>";
  }

  function applyResultTab(root) {
    if (!SPLIT_REACTIONS) return;
    root.querySelectorAll("[data-result-panel]").forEach(function (panel) {
      panel.hidden = panel.dataset.resultPanel !== state.resultsTab;
    });
    root.querySelectorAll("[data-result]").forEach(function (btn) {
      btn.className = btn.dataset.result === state.resultsTab ? "on" : "";
    });
  }

  function reactionBody(model) {
    var notes = (model.mods.corrosion ? '<p class="hint">Corrosion removes ' + Math.round(model.mods.corrosion * 10) / 10 + " resistance after Arts Intensity.</p>" : "") +
      (model.mods.breachTaken ? '<p class="hint">Breach increases Physical DMG taken by ' + C.pct(model.mods.breachTaken) + ".</p>" : "") +
      (model.mods.electroTaken ? '<p class="hint">Electrification increases Arts DMG taken by ' + C.pct(model.mods.electroTaken) + ".</p>" : "");
    var inner = '<p class="hint">These are separate from the skill multipliers. The stack box on a row changes that effect. Arts Burst does not scale with stacks. Breach also lists the Physical DMG taken debuff, which grows with Arts Intensity.</p>' +
      reactionTable(model.reactions) + notes;
    if (SPLIT_REACTIONS) return inner;
    return '<details id="reactions" class="menu"><summary>Reactions<span>' + model.reactions.hits.length + " effects</span></summary>" + inner + "</details>";
  }

  function groupHits(hits) {
    const order = ["basic", "battle", "combo", "ultimate", "set"];
    const labels = { basic: "Basic Attack", battle: "Battle Skill", combo: "Combo Skill", ultimate: "Ultimate", set: "Set effect" };
    const buckets = {};
    hits.forEach(function (hit) {
      const key = groupKey(hit.skill.kind);
      if (!buckets[key]) buckets[key] = [];
      buckets[key].push(hit);
    });
    return order.filter(function (key) { return buckets[key]; }).map(function (key) {
      const list = buckets[key];
      const names = {};
      list.forEach(function (hit) { names[skillTitle(hit.skill)] = true; });
      return { key: key, label: labels[key], hits: list, manyNames: key !== "basic" && Object.keys(names).length > 1 };
    });
  }

  function skillTitle(skill) {
    if (skill.id === "chr_0032_lizhiyan_ultimate_skill2") return "Gloompurger Array";
    if (skill.id === "chr_0032_lizhiyan_ultimate_skill") return "Gloompurge Arcana";
    return skill.name.replace(/ \d+$/, "");
  }

  function arcaneForm(skill, row, seen) {
    if (skill.id.indexOf("lizhiyan") < 0 || !row.damage) return "";
    const key = row.label;
    seen[key] = (seen[key] || 0) + 1;
    const n = seen[key];
    if (skill.id.endsWith("normal_skill") && key === "DMG Multiplier") {
      return n === 1 ? "Array Arcana: INT  ·  Intellect at least Will" : "Array Arcana: WILL  ·  Will higher than Intellect";
    }
    if (key === "Gloompurge Arcana DMG Multiplier" || key === "Cluster Strike Total DMG Multiplier") {
      return n === 1 ? "Array Arcana: INT" : "Array Arcana: WILL";
    }
    if (key === "Bonus DMG Multiplier") return "Array Arcana: INT";
    if (key === "Base DMG Multiplier" || key === "Explosion DMG Multiplier" || key === "Gloompurger Array Creation DMG Multiplier") {
      return "Both forms";
    }
    return "";
  }

  function groupKey(kind) {
    if (kind === "set") return "set";
    if (kind === "dive" || kind === "dash" || kind === "finisher" || kind === "basic") return "basic";
    if (kind === "battle" || kind === "combo" || kind === "ultimate") return kind;
    return "basic";
  }

  function staggerNote(value) {
    if (value == null) return "";
    const shown = Math.round(value * 10) / 10;
    const text = shown % 1 === 0 ? String(shown) : shown.toFixed(1);
    return '<div class="stag-note">Stagger ' + text + "</div>";
  }

  function hitLabel(hit) {
    return hit.row.label
      .replace(/^BATK SEQ/, "Sequence")
      .replace(/ Multiplier$/, "");
  }

  function statBox(value, label) {
    return '<div class="stat"><b>' + value + "</b><span>" + label + "</span></div>";
  }

  function reactionTable(reactions) {
    const rows = reactions.hits.map(function (hit) {
      const extra = hit.note ? '<div class="hint">' + hit.note + (hit.total ? " Full duration " + hit.total.toLocaleString() + "." : "") + "</div>" : "";
      const stack = hit.stackKey
        ? ' <input class="stack-input" data-rstack="' + hit.stackKey + '" type="number" min="1" max="4" value="' + (state.reactionStacks[hit.stackKey] || 4) + '"> stacks'
        : "";
      const debuff = hit.debuff != null ? '<div class="stag-note">Physical DMG taken +' + C.pct(hit.debuff) + "</div>" : "";
      return "<tr><td>" + escapeHtml(hit.name) + stack + extra + staggerNote(hit.stagger) + debuff + "</td><td class='num'>" + C.pct(hit.multiplier) +
        "</td><td class='num'>" + hit.noncrit.toLocaleString() + "</td><td class='num'>" +
        (hit.canCrit ? hit.crit.toLocaleString() : "—") + "</td></tr>";
    }).join("");
    return "<table><thead><tr><th>Effect</th><th class='num'>Base</th><th class='num'>Hit</th><th class='num'>Crit</th></tr></thead><tbody>" + rows + "</tbody></table>";
  }

  // First pass so weapon caps exist before the form is drawn.
  syncCaps();
  if (state.weaponId && !data.weaponsById[state.weaponId]) state.weaponId = "";
  if (!data.operatorsById[state.operatorId]) state.operatorId = "chr_0002_endminm";
  render();
})();
