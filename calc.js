/* Damage math for Arknights: Endfield.
   Formula source: Endfield Talos Wiki, Damage calculation.
   https://endfield.wiki.gg/wiki/Damage_calculation
   Skill multipliers come from the same tables Warfarin displays. */
(function () {
  const TYPE_BY_PREFIX = {
    sword: "Sword",
    funnel: "Arts Unit",
    claym: "Greatsword",
    lance: "Polearm",
    pistol: "Handcannon",
  };

  const ELEMENTS = ["Physical", "Heat", "Electric", "Cryo", "Nature"];

  // Always-on 3-piece bonuses, plus optional lines the player turns on.
  // Numbers are from the Endfield Talos Wiki gear pages and Prydwen's gear-set guide.
  const SET_BONUSES = {
    suit_attri01: {
      always: [{ stat: "atkPct", value: 0.15, label: "ATK +15%" }],
      options: [
        { id: "smash", label: "Next Battle Skill DMG +30% per Bonekrushing Smash stack", stat: "battle", value: 0.3, max: 2 },
      ],
    },
    suit_atk02: {
      always: [{ stat: "atkPct", value: 0.15, label: "ATK +15%" }],
      options: [
        { id: "edge", label: "Next Combo Skill DMG +20% per Yinglung's Edge stack", stat: "combo", value: 0.2, max: 3 },
      ],
    },
    suit_fire_natr01: {
      always: [{ stat: "ai", value: 30, label: "Arts Intensity +30" }],
      options: [
        { id: "heat", label: "After Combustion: Heat DMG +50%", stat: "heat", value: 0.5 },
        { id: "nature", label: "After Corrosion: Nature DMG +50%", stat: "nature", value: 0.5 },
      ],
    },
    suit_pulse_cryst01: {
      always: [{ stat: "ai", value: 30, label: "Arts Intensity +30" }],
      options: [
        { id: "electric", label: "After Electrification: Electric DMG +50%", stat: "electric", value: 0.5 },
        { id: "cryo", label: "After Solidification: Cryo DMG +50%", stat: "cryo", value: 0.5 },
      ],
    },
    suit_criti01: {
      always: [{ stat: "critRate", value: 0.05, label: "Critical Rate +5%" }],
      options: [
        { id: "atk", label: "ATK +5% per critical-hit stack", stat: "atkPct", value: 0.05, max: 5 },
        { id: "crit", label: "Extra Critical Rate +5% at max stacks", stat: "critRate", value: 0.05 },
      ],
    },
    suit_burst01: {
      always: [{ stat: "allSkill", value: 0.2, label: "All Skill DMG +20%" }],
      options: [
        { id: "arts", label: "After 2+ Infliction stacks: Arts DMG +35%", stat: "arts", value: 0.35 },
      ],
    },
    suit_phy01: {
      text: "Stagger efficiency +20%. After the wearer applies a Physical Status, they also deal 1 hit of 250% ATK Physical DMG and 10 Stagger. Cooldown: 15s.",
      always: [{ stat: "staggerEff", value: 0.2, label: "Stagger efficiency +20%" }],
      options: [
        { id: "follow", label: "Count the Physical Status follow-up (250% ATK, 10 Stagger)", hit: { name: "Swordmancer follow-up", multiplier: 2.5, element: "Physical", stagger: 10 } },
      ],
    },
    suit_poise01: {
      always: [{ stat: "atkPct", value: 0.08, label: "ATK +8%" }],
      options: [
        { id: "phys", label: "Physical DMG +8% per Vulnerability stack applied", stat: "physical", value: 0.08, max: 4 },
        { id: "phys4", label: "Extra Physical DMG +16% at 4 Vulnerability stacks", stat: "physical", value: 0.16 },
      ],
    },
    suit_spellburst: {
      always: [{ stat: "arts", value: 0.16, label: "Arts DMG +16%" }],
      options: [
        { id: "ai", label: "Arts Intensity +16 per Nature or Cryo Burst stack", stat: "ai", value: 16, max: 3 },
      ],
    },
    suit_generaltype: {
      text: "DMG Dealt +20% for all damage, DMG Reduction +10% against all damage, and Ultimate Gain Efficiency +10%.",
      always: [{ stat: "dmg", value: 0.2, label: "DMG Dealt +20%" }],
      options: [],
    },
    suit_atk01: {
      always: [{ stat: "allSkill", value: 0.24, label: "Skill DMG +24%" }],
      options: [
        { id: "atk", label: "ATK +5% per skill-type cast", stat: "atkPct", value: 0.05, max: 3 },
      ],
    },
    suit_atb01: {
      always: [],
      options: [
        { id: "dmg", label: "After the wearer recovers SP: team DMG +16%", stat: "dmg", value: 0.16 },
      ],
    },
    suit_usp02: {
      text: "HP +1000. After the wearer applies Amp, Protected, Susceptibility, or Weakened, other teammates gain DMG Dealt +16% for 15s. This effect cannot stack.",
      always: [],
      options: [
        { id: "dmg", label: "Teammates' DMG Dealt +16% after Amp, Protect, Susceptibility, or Weakness", stat: "dmg", value: 0.16 },
      ],
    },
    suit_agi01: {
      text: "Agility +50. When the wearer's HP is above 80%, Physical DMG +20%.",
      always: [{ stat: "agi", value: 50, label: "Agility +50" }],
      options: [
        { id: "hp", label: "HP above 80%: Physical DMG +20%", stat: "physical", value: 0.2 },
      ],
    },
    suit_str01: {
      text: "Strength +50. When the wearer's HP is below 50%, DMG Reduction +30% against all damage.",
      always: [{ stat: "str", value: 50, label: "Strength +50" }],
      options: [],
    },
    suit_wisdwill01: {
      text: "HP +500. After the wearer defeats an enemy, the wearer gains ATK +20 for 5s.",
      always: [],
      options: [
        { id: "atk", label: "After a defeat: ATK +20", stat: "atkFlat", value: 20 },
      ],
    },
    suit_stragi01: {
      text: "HP +500. After the wearer defeats an enemy, the wearer restores 100 HP. Cooldown: 5s.",
      always: [],
      options: [],
    },
    suit_combo_cd01: {
      text: "Combo Skill cooldown reduction +15%. When the wearer casts a combo skill, Skill DMG +20% for every skill for 15s. This can reach 2 stacks, and each stack is timed separately.",
      always: [],
      options: [
        { id: "skill", label: "After a combo skill: Skill DMG +20% per stack", stat: "allSkill", value: 0.2, max: 2 },
      ],
    },
    suit_usp01: {
      text: "Ultimate Gain Efficiency +20%. The first Battle Skill in a battle returns 50 SP.",
      always: [],
      options: [],
    },
    suit_crush_fracture: {
      text: "ATK +8%. When the wearer applies Crush or Breach, Physical DMG +[6% × Vulnerability stacks consumed from one enemy] for 20s. If the target already has Physical Susceptibility, is Staggered, or has Originium Crystals, that buff is 1.5 times as strong. The buff cannot stack.",
      always: [{ stat: "atkPct", value: 0.08, label: "ATK +8%" }],
      options: [
        { id: "phys", label: "Physical DMG +6% per Vulnerability stack consumed", stat: "physical", value: 0.06, max: 4 },
        { id: "boost", label: "1.5× condition: add another 3% Physical DMG per stack (match the stack count above)", stat: "physical", value: 0.03, max: 4 },
      ],
    },
    suit_expend_spell01: {
      text: "ATK +10%. Whenever the wearer consumes Electrification or Corrosion, they gain one stack per Status Level consumed. Each stack gives Electric DMG and Nature DMG +15% for 25s. Maximum 3 stacks, timed separately.",
      always: [{ stat: "atkPct", value: 0.1, label: "ATK +10%" }],
      options: [
        { id: "stacks", label: "Electric and Nature DMG +15% per consumed Status Level", also: ["electric", "nature"], value: 0.15, max: 3 },
      ],
    },
    suit_heal01: {
      text: "HP Treatment Efficiency +20%. After the wearer treats an ally, that ally gains DMG Reduction +15% for 10s. If the treatment exceeds their Max HP, the reduction is +30% instead. These effects cannot stack.",
      always: [],
      options: [],
    },
    suit_will01: {
      text: "Will +50. When the wearer's HP is below 50%, Treatment Effect +30%.",
      always: [{ stat: "wil", value: 50, label: "Will +50" }],
      options: [],
    },
    suit_wisd01: {
      text: "Intellect +50. When the wearer's HP is above 80%, Arts DMG +20%.",
      always: [{ stat: "int", value: 50, label: "Intellect +50" }],
      options: [
        { id: "hp", label: "HP above 80%: Arts DMG +20%", stat: "arts", value: 0.2 },
      ],
    },
  };

  function weaponFamily(id) {
    if (!id) return "";
    return TYPE_BY_PREFIX[id.split("_")[1]] || "";
  }

  function prepare(data) {
    const weaponIds = {};
    data.weapons.forEach(function (w) { weaponIds[w.id] = true; });
    data.weapons = data.weapons.filter(function (w) {
      return !(/_ink$/.test(w.id) && weaponIds[w.id.replace(/_ink$/, "")]);
    });
    data.operators.forEach(function (op) {
      if (op.id === "chr_0002_endminm") op.name = "Endministrator (Male)";
      if (op.id === "chr_0003_endminf") op.name = "Endministrator (Female)";
      if (op.name === "Mifu") op.name = "Mi Fu";
      const family = weaponFamily(op.weaponId);
      if (family) op.weapon = family;
    });
    data.weapons.forEach(function (w) {
      const family = weaponFamily(w.id);
      if (family) w.type = family;
    });
    data.setsById = {};
    data.sets.forEach(function (s) { data.setsById[s.id] = s; });
    data.operatorsById = {};
    data.operators.forEach(function (op) { data.operatorsById[op.id] = op; });
    data.weaponsById = {};
    data.weapons.forEach(function (w) { data.weaponsById[w.id] = w; });
    data.gearById = {};
    data.gear.forEach(function (g) { data.gearById[g.id] = g; });
    return data;
  }

  function emptyBag() {
    return {
      str: 0, agi: 0, int: 0, wil: 0,
      mainFlat: 0, subFlat: 0, mainPct: 0, subPct: 0,
      atkPct: 0, atkFlat: 0,
      critRate: 0, critDmg: 0, ai: 0,
      dmg: 0, physical: 0, heat: 0, electric: 0, cryo: 0, nature: 0, arts: 0,
      basic: 0, battle: 0, combo: 0, ultimate: 0, allSkill: 0, vsStagger: 0, staggerEff: 0,
      amp: { Physical: 0, Heat: 0, Electric: 0, Cryo: 0, Nature: 0, Arts: 0 },
      sus: { Physical: 0, Heat: 0, Electric: 0, Cryo: 0, Nature: 0, Arts: 0 },
      taken: 0,
      weakness: [],
      protect: 0,
    };
  }

  function addStat(bag, stat, value) {
    if (!value) return;
    if (stat === "atkPct") bag.atkPct += value;
    else if (stat === "atkFlat") bag.atkFlat += value;
    else if (stat === "ai") bag.ai += value;
    else if (stat === "critRate") bag.critRate += value;
    else if (stat === "critDmg") bag.critDmg += value;
    else if (stat === "dmg") bag.dmg += value;
    else if (stat === "physical") bag.physical += value;
    else if (stat === "heat") bag.heat += value;
    else if (stat === "electric") bag.electric += value;
    else if (stat === "cryo") bag.cryo += value;
    else if (stat === "nature") bag.nature += value;
    else if (stat === "arts") bag.arts += value;
    else if (stat === "basic") bag.basic += value;
    else if (stat === "battle") bag.battle += value;
    else if (stat === "combo") bag.combo += value;
    else if (stat === "ultimate") bag.ultimate += value;
    else if (stat === "allSkill") bag.allSkill += value;
    else if (stat === "vsStagger") bag.vsStagger += value;
    else if (stat === "staggerEff") bag.staggerEff += value;
    else if (stat === "taken") bag.taken += value;
    else if (stat === "str") bag.str += value;
    else if (stat === "agi") bag.agi += value;
    else if (stat === "int") bag.int += value;
    else if (stat === "wil") bag.wil += value;
    else if (stat === "main") bag.mainFlat += value;
    else if (stat === "sub") bag.subFlat += value;
  }

  function addGearStat(bag, stat, value, mod) {
    if (stat === "Str") bag.str += value;
    else if (stat === "Agi") bag.agi += value;
    else if (stat === "Wisd") bag.int += value;
    else if (stat === "Will") bag.wil += value;
    else if (stat === "Main") { if (mod === 6) bag.mainPct += value; else bag.mainFlat += value; }
    else if (stat === "Sub") { if (mod === 6) bag.subPct += value; else bag.subFlat += value; }
    else if (stat === "Atk") { if (mod === 6) bag.atkPct += value; else bag.atkFlat += value; }
    else if (stat === "CriticalRate") bag.critRate += value;
    else if (stat === "PhysicalAndSpellInflictionEnhance") bag.ai += value;
    else if (stat === "PhysicalDamageIncrease") bag.physical += value;
    else if (stat === "SpellDamageIncrease") bag.arts += value;
    else if (stat === "FireAndNaturalDamageIncrease") { bag.heat += value; bag.nature += value; }
    else if (stat === "CrystAndPulseDamageIncrease") { bag.cryo += value; bag.electric += value; }
    else if (stat === "AllSkillDamageIncrease") bag.allSkill += value;
    else if (stat === "NormalSkillDamageIncrease") bag.battle += value;
    else if (stat === "ComboSkillDamageIncrease") bag.combo += value;
    else if (stat === "UltimateSkillDamageIncrease") bag.ultimate += value;
    else if (stat === "NormalAttackDamageIncrease") bag.basic += value;
    else if (stat === "DamageToBrokenUnitIncrease") bag.vsStagger += value;
  }

  function asFraction(value) {
    if (Math.abs(value) > 2) return value / 100;
    return value;
  }

  // Weapon attribute nodes. Fractions such as 0.39 are percents. A few 3-star
  // nodes store the percent as 33.6 instead.
  function applyWeaponNode(bag, key, value) {
    const fractionKeys = {
      atk: "atkPct",
      hp: "hpPct",
      crirate: "critRate",
      phydam: "physical",
      firedam: "heat",
      electrondam: "electric",
      crystdam: "cryo",
      naturaldam: "nature",
      spelldam: "arts",
      heal: null,
      usgs: null,
    };
    if (key === "str") bag.str += value;
    else if (key === "agi") bag.agi += value;
    else if (key === "wisd") bag.int += value;
    else if (key === "will") bag.wil += value;
    else if (key === "mainattr") bag.mainFlat += value;
    else if (key === "physpell") bag.ai += value;
    else if (key === "atk_up") bag.atkPct += asFraction(value);
    else if (fractionKeys[key]) addStat(bag, fractionKeys[key], value);
  }

  function describeStatLine(key, value) {
    const named = {
      str: ["Strength", false],
      agi: ["Agility", false],
      wisd: ["Intellect", false],
      will: ["Will", false],
      mainattr: ["Main Attribute", false],
      physpell: ["Arts Intensity", false],
      atk: ["ATK", true],
      atk_up: ["ATK", true],
      hp: ["HP", true],
      crirate: ["Critical Rate", true],
      phydam: ["Physical DMG", true],
      firedam: ["Heat DMG", true],
      electrondam: ["Electric DMG", true],
      crystdam: ["Cryo DMG", true],
      naturaldam: ["Nature DMG", true],
      spelldam: ["Arts DMG", true],
      heal: ["Treatment", true],
      usgs: ["Ultimate Gain", true],
    };
    const info = named[key];
    if (!info) return null;
    if (!info[1]) return info[0] + " +" + trimNum(value);
    return info[0] + " +" + pct(asFraction(value));
  }

  function describeParts(parts) {
    const lines = [];
    (parts || []).forEach(function (part) {
      const line = describeStatLine(part.key, part.value);
      if (line) lines.push(line);
    });
    return lines.join(", ");
  }

  function describePassive(key, value) {
    const names = {
      atk_up: "ATK",
      atk_up_add: "ATK",
      atk_up1: "ATK",
      atk_up2: "ATK",
      atk_up_mult: "ATK",
      dmg_up: "DMG Dealt",
      dmg_up2: "DMG Dealt",
      phy_dmg_up: "Physical DMG",
      phy_dmg_up2: "Physical DMG",
      phy_dmg_up3: "Physical DMG",
      phy_damage_up: "Physical DMG",
      phy_damage_up2: "Physical DMG",
      phy_dmg_up_mult: "Physical DMG",
      fire_dmg_up: "Heat DMG",
      pulse_dmg_up: "Electric DMG",
      pulse_dmg_up2: "Electric DMG",
      pulse_dmg_up3: "Electric DMG",
      cryst_dmg_up: "Cryo DMG",
      cryst_dmg_up2: "Cryo DMG",
      nature_dmg_up: "Nature DMG",
      nature_dmg_up2: "Nature DMG",
      nature_dmg_up_mult: "Nature DMG",
      spell_dmg_up: "Arts DMG",
      spell_dmg_up2: "Arts DMG",
      spell_dmg_up3: "Arts DMG",
      combo_dmg_up: "Combo Skill DMG",
      normal_atk_up: "Basic Attack DMG",
      crit_up: "Critical Rate",
      crit_up2: "Critical Rate",
      all_attr_up: "All Attributes",
      all_attr_up2: "All Attributes",
      primary_attr_up: "Main Attribute",
      second_attr_up: "Secondary Attribute",
      heal_up: "Treatment Efficiency",
      hp_up: "Max HP",
      def_up: "DEF",
      shield_up: "Shield",
      ultimate_gain_up: "Ultimate Gain",
      poise_up: "Stagger dealt",
      phy_spell_up: "Arts Intensity",
      dmg_taken_up: "DMG Taken",
      spell_dmg_taken_up: "Arts DMG Taken",
      spell_dmg_taken_up2: "Arts DMG Taken",
      spell_damage_taken_up: "Arts DMG Taken",
    };
    if (!names[key]) return null;
    if (key === "phy_spell_up") {
      return { label: "Arts Intensity +" + trimNum(value), stat: "ai", value: value };
    }
    if (key === "poise_up") {
      return { label: "Stagger dealt +" + pct(asFraction(value)), stat: "staggerEff", value: asFraction(value) };
    }
    if (key.indexOf("taken") >= 0) {
      return { label: names[key] + " +" + pct(asFraction(value)), stat: "taken", value: asFraction(value) };
    }
    if (key.indexOf("crit") >= 0) {
      return { label: names[key] + " +" + pct(asFraction(value)), stat: "critRate", value: asFraction(value) };
    }
    if (key.indexOf("attr") >= 0) {
      const stat = key.indexOf("primary") >= 0 ? "mainPct" : key.indexOf("second") >= 0 ? "subPct" : "allAttr";
      return { label: names[key] + " +" + pct(asFraction(value)), stat: stat, value: asFraction(value) };
    }
    const stat = {
      "ATK": "atkPct",
      "DMG Dealt": "dmg",
      "Physical DMG": "physical",
      "Heat DMG": "heat",
      "Electric DMG": "electric",
      "Cryo DMG": "cryo",
      "Nature DMG": "nature",
      "Arts DMG": "arts",
      "Combo Skill DMG": "combo",
      "Basic Attack DMG": "basic",
      "Max HP": "hpPct",
      "DEF": null,
      "Shield": null,
      "Treatment Efficiency": null,
      "Ultimate Gain": null,
    }[names[key]];
    return { label: names[key] + " +" + pct(asFraction(value)), stat: stat, value: asFraction(value) };
  }

  function pct(n) {
    return trimNum(n * 100) + "%";
  }

  function trimNum(n) {
    const r = Math.round(n * 1000) / 1000;
    return String(r);
  }

  function skillRank(skill, rank) {
    const levels = skill.levels;
    let found = levels[0];
    levels.forEach(function (lv) { if (lv.level === rank) found = lv; });
    return found;
  }

  function stageFor(weapon, level) {
    let stage = weapon.stages[0];
    weapon.stages.forEach(function (s) {
      if (level >= s.level) stage = s;
    });
    return stage;
  }

  function nodeAt(nodes, rank) {
    if (!nodes || !nodes.length) return null;
    let found = nodes[0];
    nodes.forEach(function (n) { if (n.level === rank) found = n; });
    return found;
  }

  function applyBagLine(bag, stat, value) {
    if (stat === "mainPct") bag.mainPct += value;
    else if (stat === "subPct") bag.subPct += value;
    else if (stat === "allAttr") {
      bag.mainPct += value;
      bag.subPct += value;
    } else addStat(bag, stat, value);
  }

  function buildStats(data, state) {
    const op = data.operatorsById[state.operatorId];
    const level = clamp(state.level, 1, 90);
    const row = op.levels[level - 1];
    const base = { atk: row[0], hp: row[1], str: row[2], agi: row[3], int: row[4], wil: row[5] };
    const attrOf = { Strength: "str", Agility: "agi", Intellect: "int", Will: "wil" };
    const bag = emptyBag();
    const notes = [];

    const weapon = state.weaponId ? data.weaponsById[state.weaponId] : null;
    let weaponAtk = 0;
    if (weapon) {
      const wl = clamp(state.weaponLevel, 1, weapon.atk.length);
      weaponAtk = weapon.atk[wl - 1];
      const stage = stageFor(weapon, wl);
      const cap1 = stage.caps[0] || 1;
      const cap2 = stage.caps[1] || 1;
      const passiveLevels = weapon.passive ? weapon.passive.length : 1;
      const capP = passiveLevels;
      const r1 = clamp(state.stat1 || cap1, 1, cap1);
      const r2 = clamp(state.stat2 || cap2, 1, cap2);
      const rp = clamp(state.passiveRank || capP, 1, capP);
      const n1 = nodeAt(weapon.stat1, r1);
      const n2 = nodeAt(weapon.stat2, r2);
      if (n1) n1.parts.forEach(function (p) { applyWeaponNode(bag, p.key, p.value); });
      if (n2) n2.parts.forEach(function (p) { applyWeaponNode(bag, p.key, p.value); });
      const passive = nodeAt(weapon.passive, rp);
      const passiveOptions = [];
      if (passive) {
        let lastOption = null;
        passive.parts.forEach(function (p, index) {
          if (/^duration/.test(p.key)) {
            if (lastOption) lastOption.label += " for " + trimNum(p.value) + "s";
            return;
          }
          const described = describePassive(p.key, p.value);
          if (!described) return;
          lastOption = {
            id: weapon.id + ":" + index,
            label: described.label,
            stat: described.stat,
            value: described.value,
          };
          passiveOptions.push(lastOption);
          if (state.passiveOn && state.passiveOn[weapon.id + ":" + index]) {
            applyBagLine(bag, described.stat, described.value);
            notes.push(weapon.name + ": " + described.label);
          }
        });
      }
      state._passiveOptions = passiveOptions;
      state._caps = { stat1: cap1, stat2: cap2, passive: capP, weaponAtk: weaponAtk };
    } else {
      state._passiveOptions = [];
      state._caps = { stat1: 1, stat2: 1, passive: 1, weaponAtk: 0 };
    }

    const gearIds = state.gear || [];
    const suitCount = {};
    gearIds.forEach(function (id) {
      const g = data.gearById[id];
      if (!g) return;
      if (g.suit) suitCount[g.suit] = (suitCount[g.suit] || 0) + 1;
      g.stats.forEach(function (s) { addGearStat(bag, s.stat, s.value, s.mod); });
    });

    const activeSets = [];
    const setHits = [];
    Object.keys(suitCount).forEach(function (id) {
      if (suitCount[id] >= 3) activeSets.push(id);
    });
    activeSets.forEach(function (id) {
      const bonus = SET_BONUSES[id];
      const setName = (data.setsById[id] && data.setsById[id].name) || id;
      if (!bonus) return;
      bonus.always.forEach(function (line) {
        addStat(bag, line.stat, line.value);
        notes.push(setName + ": " + line.label);
      });
      (bonus.options || []).forEach(function (opt) {
        const key = id + ":" + opt.id;
        const stacks = state.setOn && state.setOn[key];
        if (!stacks) return;
        const count = opt.max ? Math.min(opt.max, stacks) : 1;
        if (opt.hit) {
          setHits.push({ key: key, name: opt.hit.name, multiplier: opt.hit.multiplier, element: opt.hit.element, stagger: opt.hit.stagger });
        } else if (opt.also) {
          opt.also.forEach(function (stat) { addStat(bag, stat, opt.value * count); });
        } else if (opt.stat) {
          addStat(bag, opt.stat, opt.value * count);
        }
        notes.push(setName + ": " + opt.label + (opt.max ? " ×" + count : ""));
      });
    });

    (state.extraLines || []).forEach(function (line) {
      if (!line.on) return;
      applyBagLine(bag, line.stat, line.value * (line.stacks || 1));
    });

    if (state.manual) {
      addStat(bag, "atkPct", num(state.manual.atkPct) / 100);
      addStat(bag, "atkFlat", num(state.manual.atkFlat));
      addStat(bag, "dmg", num(state.manual.dmg) / 100);
      addStat(bag, "critRate", num(state.manual.critRate) / 100);
      addStat(bag, "critDmg", num(state.manual.critDmg) / 100);
      addStat(bag, "ai", num(state.manual.ai));
      addStat(bag, "taken", num(state.manual.taken) / 100);
      const amp = num(state.manual.amp) / 100;
      if (amp) {
        const el = state.manual.ampElement || op.element;
        if (el === "Arts") ELEMENTS.forEach(function (name) { if (name !== "Physical") bag.amp[name] += amp; });
        else bag.amp[el] = (bag.amp[el] || 0) + amp;
      }
    }

    const mainKey = attrOf[op.main];
    const subKey = attrOf[op.sub];
    const totals = {
      str: base.str * (mainKey === "str" ? (1 + bag.mainPct) : subKey === "str" ? (1 + bag.subPct) : 1) + bag.str + (mainKey === "str" ? bag.mainFlat : 0) + (subKey === "str" ? bag.subFlat : 0),
      agi: base.agi * (mainKey === "agi" ? (1 + bag.mainPct) : subKey === "agi" ? (1 + bag.subPct) : 1) + bag.agi + (mainKey === "agi" ? bag.mainFlat : 0) + (subKey === "agi" ? bag.subFlat : 0),
      int: base.int * (mainKey === "int" ? (1 + bag.mainPct) : subKey === "int" ? (1 + bag.subPct) : 1) + bag.int + (mainKey === "int" ? bag.mainFlat : 0) + (subKey === "int" ? bag.subFlat : 0),
      wil: base.wil * (mainKey === "wil" ? (1 + bag.mainPct) : subKey === "wil" ? (1 + bag.subPct) : 1) + bag.wil + (mainKey === "wil" ? bag.mainFlat : 0) + (subKey === "wil" ? bag.subFlat : 0),
    };
    const main = totals[mainKey];
    const sub = totals[subKey];
    const attributeBonus = 1 + 0.005 * main + 0.002 * sub;
    const baseAtk = (base.atk + weaponAtk) * (1 + bag.atkPct) + bag.atkFlat;
    const attack = baseAtk * attributeBonus;

    return {
      op: op,
      level: level,
      base: base,
      totals: totals,
      main: main,
      sub: sub,
      attributeBonus: attributeBonus,
      weaponAtk: weaponAtk,
      baseAtk: baseAtk,
      attack: attack,
      screenAtk: Math.floor(attack),
      critRate: 0.05 + bag.critRate,
      critDmg: 0.5 + bag.critDmg,
      ai: bag.ai,
      bag: bag,
      notes: notes,
      activeSets: activeSets,
      setHits: setHits,
      caps: state._caps,
      passiveOptions: state._passiveOptions,
    };
  }

  function skillBonus(bag, kind) {
    if (kind === "basic" || kind === "dive" || kind === "dash" || kind === "finisher") return bag.basic;
    if (kind === "battle") return bag.battle + bag.allSkill;
    if (kind === "combo") return bag.combo + bag.allSkill;
    if (kind === "ultimate") return bag.ultimate + bag.allSkill;
    return 0;
  }

  function elementBonus(bag, element) {
    let bonus = bag.dmg + (bag[elementKey(element)] || 0);
    if (element !== "Physical") bonus += bag.arts;
    return bonus;
  }

  function elementKey(element) {
    return { Physical: "physical", Heat: "heat", Electric: "electric", Cryo: "cryo", Nature: "nature" }[element] || "physical";
  }

  function ampFor(bag, element) {
    const specific = bag.amp[element] || 0;
    const arts = element === "Physical" ? 0 : (bag.amp.Arts || 0);
    return specific + arts;
  }

  function susFor(bag, element) {
    const specific = bag.sus[element] || 0;
    const arts = element === "Physical" ? 0 : (bag.sus.Arts || 0);
    return specific + arts;
  }

  function hiddenMultiplier(level, family) {
    if (family === "physical") return 1 + (level - 1) / 392;
    return 1 + (level - 1) / 196;
  }

  function aiEnhance(ai) {
    return 1 + (2 * ai) / (ai + 300);
  }

  function defenseMultiplier(def) {
    if (def >= 0) return 100 / (def + 100);
    return 2 - Math.pow(0.99, -def);
  }

  function resistanceMultiplier(res, ignore, corrosion) {
    return (100 - res + ignore + corrosion) / 100;
  }

  function linkBonus(kind, stacks) {
    if (!stacks) return 0;
    const battle = [0, 0.3, 0.45, 0.6, 0.75];
    const ult = [0, 0.2, 0.3, 0.4, 0.5];
    const table = kind === "ultimate" ? ult : battle;
    if (kind !== "battle" && kind !== "ultimate") return 0;
    return table[Math.min(4, stacks)] || 0;
  }

  function finisherMultiplier(tier) {
    return { common: 1, advanced: 1.25, elite: 1.5, boss: 1.75 }[tier] || 1;
  }

  function product(list) {
    return list.reduce(function (acc, n) { return acc * n; }, 1);
  }

  // One hit. `multiplier` is the ATK ratio (2.8 means 280%).
  function strike(stats, spec) {
    const bag = stats.bag;
    const enemy = spec.enemy;
    const groups = 1 + elementBonus(bag, spec.element) + skillBonus(bag, spec.kind) + (enemy.staggered ? bag.vsStagger : 0);
    const critMult = spec.canCrit ? (1 + stats.critDmg) : 1;
    const amp = 1 + ampFor(bag, spec.element);
    const stagger = enemy.staggered ? 1.3 : 1;
    const finisher = spec.kind === "finisher" && enemy.staggered ? finisherMultiplier(enemy.finisherTier) : 1;
    const link = 1 + linkBonus(spec.kind, enemy.link || 0);
    const weakEffect = typeof enemy.weakness === "number" ? enemy.weakness : 0;
    const weakness = (1 - weakEffect) * product(bag.weakness.map(function (w) { return 1 - w; }));
    const sus = 1 + (susFor(bag, spec.element) + (enemy.sus || 0)) * (spec.susMult || 1);
    const taken = 1 + bag.taken + (spec.taken || 0);
    const protect = 1 - (enemy.protect || 0);
    const defense = defenseMultiplier(enemy.def);
    const corrosion = spec.corrosion || 0;
    const resistance = resistanceMultiplier(enemy.resFor(spec.element), enemy.ignoreRes || 0, corrosion);
    const hidden = spec.hidden || 1;
    const intensity = spec.intensity || 1;
    const extra = spec.extra || 1;

    const exact = stats.attack * spec.multiplier * groups * amp * stagger * finisher * link * weakness * sus * taken * protect * defense * resistance * hidden * intensity * extra;
    const canCrit = spec.canCrit !== false;
    const noncrit = Math.floor(Math.max(0, exact));
    const critExact = canCrit ? exact * critMult : exact;
    const crit = Math.floor(Math.max(0, critExact));
    const rate = Math.max(0, Math.min(1, stats.critRate));
    const average = canCrit ? Math.floor(noncrit * (1 - rate) + crit * rate) : noncrit;
    return {
      noncrit: noncrit,
      crit: crit,
      average: average,
      canCrit: canCrit,
      exact: exact,
      parts: {
        groups: groups,
        amp: amp,
        stagger: stagger,
        finisher: finisher,
        link: link,
        weakness: weakness,
        sus: sus,
        taken: taken,
        protect: protect,
        defense: defense,
        resistance: resistance,
        hidden: hidden,
        intensity: intensity,
      },
    };
  }

  function statusMods(stats, enemy) {
    const ai = stats.ai;
    const corrLv = clamp(enemy.corrosionLevel || 0, 0, 4);
    const breachLv = clamp(enemy.breachLevel || 0, 0, 4);
    const electroLv = clamp(enemy.electroLevel || 0, 0, 4);
    const enhance = aiEnhance(ai);
    return {
      corrosion: corrLv ? [0, 12, 16, 20, 24][corrLv] * enhance : 0,
      breachTaken: breachLv ? [0, 0.12, 0.16, 0.2, 0.24][breachLv] * enhance : 0,
      electroTaken: electroLv ? [0, 0.12, 0.16, 0.2, 0.24][electroLv] * enhance : 0,
    };
  }

  function reactionHits(stats, enemy) {
    const level = stats.level;
    const ai = stats.ai;
    const intensity = 1 + ai / 100;
    const artsHidden = hiddenMultiplier(level, "arts");
    const physHidden = hiddenMultiplier(level, "physical");
    const mods = statusMods(stats, enemy);
    function stacksFor(key) {
      const bag = enemy.reactionStacks || {};
      return clamp(bag[key] == null ? 4 : bag[key], 1, 4);
    }
    const reactionStacks = stacksFor("reaction");
    const combustionStacks = stacksFor("combustion");
    const shatterStacks = stacksFor("shatter");
    const crushStacks = stacksFor("crush");
    const breachStacks = stacksFor("breach");
    const corrosion = mods.corrosion;
    const breachTaken = mods.breachTaken;
    const electroTaken = mods.electroTaken;
    const element = enemy.reactionElement || (stats.op.element === "Physical" ? "Heat" : stats.op.element);

    function row(name, multiplier, family, hitElement, canCrit, taken, stackKey) {
      const hidden = family === "physical" ? physHidden : artsHidden;
      const result = strike(stats, {
        multiplier: multiplier,
        kind: "reaction",
        element: hitElement,
        canCrit: canCrit,
        enemy: enemy,
        hidden: hidden,
        intensity: intensity,
        taken: taken || 0,
        corrosion: corrosion,
      });
      result.name = name;
      result.multiplier = multiplier;
      result.canCrit = canCrit;
      result.stackKey = stackKey || "";
      if (/^Lift \/ Knock Down/.test(name)) {
        result.stagger = 10 * (1 + ai / 200) * (1 + (stats.bag.staggerEff || 0));
      }
      return result;
    }

    const hits = [];
    const reactionBase = 0.8 + 0.8 * reactionStacks;
    hits.push(row("Arts Reaction hit", reactionBase, "arts", element === "Physical" ? "Heat" : element, true, electroTaken, "reaction"));
    hits.push(row("Arts Burst", 1.6, "arts", element === "Physical" ? "Heat" : element, true, electroTaken, ""));
    const dot = 0.12 + 0.12 * combustionStacks;
    const dotHit = row("Combustion tick", dot, "arts", "Heat", false, 0, "combustion");
    dotHit.note = "10 ticks. Damage over time cannot crit.";
    dotHit.total = dotHit.noncrit * 10;
    hits.push(dotHit);
    hits.push(row("Shatter", 1.2 + 1.2 * shatterStacks, "arts", "Physical", true, breachTaken, "shatter"));
    hits.push(row("Crush", 1.5 + 1.5 * crushStacks, "physical", "Physical", true, breachTaken, "crush"));
    const breachHit = row("Breach", 0.5 + 0.5 * breachStacks, "physical", "Physical", true, breachTaken, "breach");
    const breachBase = [0, 0.12, 0.16, 0.2, 0.24][breachStacks];
    breachHit.debuff = breachBase * (1 + (2 * ai) / (ai + 300));
    hits.push(breachHit);
    hits.push(row("Lift / Knock Down", 1.2, "physical", "Physical", true, breachTaken, ""));
    return {
      hits: hits,
      corrosion: corrosion,
      breachTaken: breachTaken,
      electroTaken: electroTaken,
      intensity: intensity,
    };
  }

  function clamp(n, lo, hi) {
    n = Math.round(Number(n) || lo);
    return Math.max(lo, Math.min(hi, n));
  }

  function num(v) {
    const n = Number(v);
    return isFinite(n) ? n : 0;
  }

  function selfTest(data) {
    const state = {
      operatorId: "chr_0002_endminm",
      level: 90,
      weaponId: "",
      weaponLevel: 1,
      potential: 0,
      stat1: 1,
      stat2: 1,
      passiveRank: 1,
      passiveOn: {},
      gear: [],
      setOn: {},
      manual: {},
      extraLines: [],
    };
    const stats = buildStats(data, state);
    const enemy = {
      def: 100,
      resFor: function () { return 0; },
      ignoreRes: 0,
      staggered: false,
      finisherTier: "common",
      link: 0,
      protect: 0,
      weakness: [],
    };
    const hit = strike(stats, {
      multiplier: 2.8,
      kind: "battle",
      element: "Physical",
      canCrit: true,
      enemy: enemy,
    });
    const yvonne = data.operatorsById["chr_0017_yvonne"];
    const lifeng = data.operatorsById["chr_0015_lifeng"];
    const ember = data.operatorsById["chr_0009_azrila"];
    const armed = buildStats(data, {
      operatorId: ember.id,
      level: 90,
      weaponId: "wpn_claym_0017",
      weaponLevel: 90,
      potential: 0,
      stat1: 9,
      stat2: 9,
      passiveRank: 4,
      passiveOn: {},
      gear: [],
      setOn: {},
      manual: {},
      extraLines: [],
    });
    const hot = data.gear.filter(function (g) { return g.suit === "suit_fire_natr01" && g.level === 70; }).slice(0, 3);
    const geared = buildStats(data, {
      operatorId: "chr_0002_endminm",
      level: 90,
      weaponId: "",
      weaponLevel: 1,
      potential: 0,
      stat1: 1,
      stat2: 1,
      passiveRank: 1,
      passiveOn: {},
      gear: hot.map(function (g) { return g.id; }),
      setOn: {},
      manual: {},
      extraLines: [],
    });
    const ok = stats.base.atk === 319 && hit.noncrit === 871 &&
      yvonne.weapon === "Handcannon" && lifeng.weapon === "Polearm" && ember.weapon === "Greatsword" &&
      armed.weaponAtk === 510 && armed.bag.atkPct >= 0.39 && armed.bag.str >= 156 &&
      hot.length === 3 && geared.ai >= 30;
    return {
      ok: ok,
      detail: [
        "atk " + stats.base.atk,
        "hit " + hit.noncrit,
        yvonne.weapon,
        lifeng.weapon,
        ember.weapon,
        "wpn " + armed.weaponAtk,
        "pct " + Math.round(armed.bag.atkPct * 100),
        "str " + armed.bag.str,
        "hot " + hot.length,
        "ai " + geared.ai,
      ].join(", "),
      attack: stats.attack,
      screenAtk: stats.screenAtk,
      noncrit: hit.noncrit,
      crit: hit.crit,
      expected: 871,
    };
  }

  window.EndfieldCalc = {
    prepare: prepare,
    buildStats: buildStats,
    strike: strike,
    reactionHits: reactionHits,
    skillRank: skillRank,
    stageFor: stageFor,
    weaponFamily: weaponFamily,
    describePassive: describePassive,
    describeParts: describeParts,
    nodeAt: nodeAt,
    SET_BONUSES: SET_BONUSES,
    ELEMENTS: ELEMENTS,
    statusMods: statusMods,
    selfTest: selfTest,
    pct: pct,
    clamp: clamp,
  };
})();
