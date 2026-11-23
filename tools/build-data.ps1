# Builds data/game.json from the Endfield table mirror (rmxlinux/EndfieldData, 2026-11-05)
# and keeps only the fields the calculator needs. Numbers are cross-checked against
# Warfarin operator pages and the Endfield Talos Wiki damage formula.
$ErrorActionPreference = "Stop"
$src = "C:\Users\Leslie\AppData\Local\Temp\endfield-data"
$outDir = Join-Path (Split-Path $PSScriptRoot -Parent) "data"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

function Read-Json([string]$name) {
    $path = Join-Path $src $name
    $text = [IO.File]::ReadAllText($path, [Text.Encoding]::UTF8)
    return $text | ConvertFrom-Json
}

function Id-String($value) {
    if ($null -eq $value) { return $null }
    if ($value -is [string]) { return $value }
    if ($value.PSObject.Properties.Name -contains "id") {
        return ([int64]$value.id).ToString()
    }
    return $null
}

function Text-Of($value) {
    if ($null -eq $value) { return "" }
    if ($value -is [string]) { return $value }
    if ($value.PSObject.Properties.Name -contains "text" -and $value.text) { return [string]$value.text }
    return ""
}

$chars = Read-Json "CharacterTable.json"
$skills = Read-Json "SkillPatchTable.json"
$weapons = Read-Json "WeaponBasicTable.json"
$curves = Read-Json "WeaponUpgradeTemplateTable.json"
$breaks = Read-Json "WeaponBreakThroughTemplateTable.json"
$equips = Read-Json "EquipTable.json"
$suits = Read-Json "EquipSuitTable.json"
$profs = Read-Json "CharProfessionTable.json"

$needed = New-Object System.Collections.Generic.HashSet[string]

function Want($id) {
    if ($id) { [void]$needed.Add($id) }
}

foreach ($p in $profs.PSObject.Properties) { Want (Id-String $p.Value.name) }
foreach ($p in $suits.PSObject.Properties) {
    foreach ($row in $p.Value.list) { Want (Id-String $row.suitName) }
}
foreach ($p in $weapons.PSObject.Properties) { Want (Id-String $p.Value.engName) }
foreach ($p in $skills.PSObject.Properties) {
    $bundle = $p.Value.SkillPatchDataBundle
    if (-not $bundle) { continue }
    foreach ($lv in $bundle) {
        foreach ($row in $lv.subDescDataList) { Want (Id-String $row.name) }
    }
}

Write-Output "Looking up $($needed.Count) text ids"
$i18nPath = Join-Path $src "I18nTextTable_EN.json"
$i18nText = [IO.File]::ReadAllText($i18nPath, [Text.Encoding]::UTF8)
$dict = @{}
$rx = [regex]'"(-?\d+)"\s*:\s*"((?:\\.|[^"\\])*)"'
foreach ($m in $rx.Matches($i18nText)) {
    $id = $m.Groups[1].Value
    if ($needed.Contains($id)) {
        $val = $m.Groups[2].Value -replace '\\n', ' ' -replace '\\"', '"' -replace '\\/', '/'
        $dict[$id] = $val
    }
}
Write-Output "Resolved $($dict.Count) labels"

function L($value) {
    $direct = Text-Of $value
    if ($direct) { return $direct }
    $id = Id-String $value
    if ($id -and $dict.ContainsKey($id)) { return $dict[$id] }
    return ""
}

$classByProf = @{}
foreach ($p in $profs.PSObject.Properties) {
    $classByProf[[string]$p.Value.profession] = L $p.Value.name
}

$elementName = @{
    Physical = "Physical"
    Fire     = "Heat"
    Pulse    = "Electric"
    Cryst    = "Cryo"
    Natural  = "Nature"
}
$attrName = @{
    "39" = "Strength"
    "40" = "Agility"
    "41" = "Intellect"
    "42" = "Will"
}
$weaponTypeName = @{
    "1" = "Sword"
    "2" = "Arts Unit"
    "3" = "Greatsword"
    "4" = "Polearm"
    "5" = "Handcannon"
}

function Attr-Map($attrs) {
    $map = @{}
    foreach ($a in $attrs) { $map[[string]$a.attrType] = [double]$a.attrValue }
    return $map
}

function Round4([double]$n) {
    return [math]::Round($n, 4)
}

$operators = @()
$skillBook = @{}

$charProps = $chars.PSObject.Properties | Where-Object { $_.Name -like "chr_*" -and $_.Name -notlike "chr_9*" }
foreach ($cp in $charProps) {
    $c = $cp.Value
    $name = Text-Of $c.engName
    if (-not $name) { $name = L $c.name }
    if (-not $name) { $name = $cp.Name }

    $byLevel = @{}
    foreach ($row in $c.attributes) {
        $m = Attr-Map $row.Attribute.attrs
        $lv = [int]$m["0"]
        if ($lv -lt 1 -or $lv -gt 90) { continue }
        # Same level can appear once per promotion. Stats do not change, so the first row is enough.
        if (-not $byLevel.ContainsKey($lv)) { $byLevel[$lv] = $m }
    }
    $levels = @()
    for ($lv = 1; $lv -le 90; $lv++) {
        if (-not $byLevel.ContainsKey($lv)) { throw "Missing level $lv for $($cp.Name)" }
        $m = $byLevel[$lv]
        $levels += ,@((Round4 $m["2"]), (Round4 $m["1"]), (Round4 $m["39"]), (Round4 $m["40"]), (Round4 $m["41"]), (Round4 $m["42"]))
    }

    $element = $elementName[[string]$c.charTypeId]
    if (-not $element) { $element = [string]$c.charTypeId }
    $className = $classByProf[[string]$c.profession]
    if (-not $className) { $className = "Class $($c.profession)" }
    $wtype = $weaponTypeName[[string]$c.weaponType]
    if (-not $wtype) { $wtype = "Weapon $($c.weaponType)" }

    $operators += [ordered]@{
        id       = $cp.Name
        name     = $name
        rarity   = [int]$c.rarity
        element  = $element
        class    = $className
        weapon   = $wtype
        main     = $attrName[[string]$c.mainAttrType]
        sub      = $attrName[[string]$c.subAttrType]
        weaponId = [string]$c.defaultWeaponId
        levels   = $levels
    }
}

function Skill-Kind([string]$id) {
    if ($id -match 'ultimate') { return "ultimate" }
    if ($id -match 'combo') { return "combo" }
    if ($id -match 'normal_skill|normalskill') { return "battle" }
    if ($id -match 'power_attack|powerattack') { return "finisher" }
    if ($id -match 'plunging') { return "dive" }
    if ($id -match 'dash_attack') { return "dash" }
    if ($id -match 'attack') { return "basic" }
    return "other"
}

function Skill-Title([string]$id, [string]$kind) {
    switch ($kind) {
        "basic" { if ($id -match 'attack(\d+)') { return "Basic Attack $($Matches[1])" } return "Basic Attack" }
        "dive" { return "Dive Attack" }
        "dash" { return "Dash Attack" }
        "finisher" { return "Finisher" }
        "battle" {
            if ($id -match 'normal_?skill_(\d+)|normalskill_(\d+)') { return "Battle Skill $($Matches[1])$($Matches[2])" }
            return "Battle Skill"
        }
        "combo" { if ($id -match 'combo_skill_(\d+)') { return "Combo Skill $($Matches[1])" } return "Combo Skill" }
        "ultimate" { return "Ultimate" }
        default { return $id }
    }
}

function Row-Role([string]$label, [string]$desc) {
    $isPct = $desc -match '%'
    $damage = $isPct -and $label -match '(?i)multiplier' -and $label -notmatch '(?i)shield|treatment|heal|energy gain|sp |cooldown|duration|stagger'
    $per = $label -match '(?i)\bper\b'
    return @{ damage = [bool]$damage; per = [bool]$per; pct = [bool]$isPct }
}

function Parse-Desc([string]$desc) {
    $t = $desc.Trim()
    $pct = $false
    if ($t -match '%') { $pct = $true; $t = $t.Replace('%', '') }
    $t = $t -replace 's$', ''
    $n = 0.0
    $ok = [double]::TryParse($t, [Globalization.NumberStyles]::Float, [Globalization.CultureInfo]::InvariantCulture, [ref]$n)
    if (-not $ok) { return $null }
    if ($pct) { return @{ n = $n / 100.0; unit = "pct" } }
    return @{ n = $n; unit = "flat" }
}

foreach ($op in $operators) {
    $prefix = $op.id + "_"
    $list = @()
    $props = $skills.PSObject.Properties | Where-Object { $_.Name.StartsWith($prefix) -and $_.Name -notmatch 'skin' }
    foreach ($sp in $props) {
        $kind = Skill-Kind $sp.Name
        if ($kind -eq "other") { continue }
        $bundle = @($sp.Value.SkillPatchDataBundle | Sort-Object { [int]$_.level })
        $levels = @()
        foreach ($lv in $bundle) {
            $rows = @()
            foreach ($row in $lv.subDescDataList) {
                $label = L $row.name
                if (-not $label) { $label = "Value" }
                $parsed = Parse-Desc ([string]$row.desc)
                if (-not $parsed) { continue }
                $role = Row-Role $label $row.desc
                $rows += [ordered]@{
                    label  = $label
                    value  = (Round4 $parsed.n)
                    unit   = $parsed.unit
                    damage = $role.damage
                    per    = $role.per
                }
            }
            $levels += [ordered]@{
                level = [int]$lv.level
                cd    = (Round4 $lv.coolDown)
                cost  = (Round4 $lv.costValue)
                rows  = $rows
            }
        }
        $list += [ordered]@{
            id     = $sp.Name
            name   = (Skill-Title $sp.Name $kind)
            kind   = $kind
            levels = $levels
        }
    }
    $order = @{ basic = 0; dive = 1; dash = 2; finisher = 3; battle = 4; combo = 5; ultimate = 6; other = 7 }
    $list = $list | Sort-Object { $order[$_.kind] }, name
    $skillBook[$op.id] = @($list)
}

function Weapon-Stat-Levels($skillId) {
    $node = $skills.$skillId
    if (-not $node) { return $null }
    $levels = @()
    foreach ($lv in ($node.SkillPatchDataBundle | Sort-Object { [int]$_.level })) {
        $parts = @()
        foreach ($b in $lv.blackboard) {
            if ([double]$b.value -eq 0) { continue }
            $parts += [ordered]@{ key = [string]$b.key; value = (Round4 $b.value) }
        }
        $rows = @()
        foreach ($row in $lv.subDescDataList) {
            $label = L $row.name
            $parsed = Parse-Desc ([string]$row.desc)
            if ($parsed) {
                $rows += [ordered]@{ label = $label; value = (Round4 $parsed.n); unit = $parsed.unit }
            }
        }
        $levels += [ordered]@{ level = [int]$lv.level; parts = $parts; rows = $rows }
    }
    return $levels
}

$weaponList = @()
foreach ($wp in $weapons.PSObject.Properties) {
    $w = $wp.Value
    $curve = $curves.($w.levelTemplateId)
    if (-not $curve) { continue }
    $atk = @()
    foreach ($row in ($curve.list | Sort-Object { [int]$_.weaponLv })) {
        $atk += [int]$row.baseAtk
    }
    $breakRows = @()
    $bt = $breaks.($w.breakthroughTemplateId)
    if ($bt) {
        foreach ($row in $bt.list) {
            $caps = @()
            foreach ($b in $row.skillLevelBounds) { $caps += [int]$b.upperBound }
            $breakRows += [ordered]@{
                level = [int]$row.breakthroughLv
                show  = [int]$row.breakthroughShowLv
                caps  = $caps
            }
        }
    }
    $skillIds = @($w.weaponSkillList)
    $stat1 = $null
    $stat2 = $null
    $passive = $null
    if ($skillIds.Count -ge 1) { $stat1 = Weapon-Stat-Levels $skillIds[0] }
    if ($skillIds.Count -ge 2) { $stat2 = Weapon-Stat-Levels $skillIds[1] }
    if ($skillIds.Count -ge 3) { $passive = Weapon-Stat-Levels $skillIds[2] }
    $wtype = $weaponTypeName[[string]$w.weaponType]
    if (-not $wtype) { $wtype = "Weapon $($w.weaponType)" }
    $wname = L $w.engName
    if (-not $wname) { $wname = $wp.Name }
    $weaponList += [ordered]@{
        id       = $wp.Name
        name     = $wname
        rarity   = [int]$w.rarity
        type     = $wtype
        atk      = $atk
        stat1    = $stat1
        stat2    = $stat2
        passive  = $passive
        stages   = $breakRows
    }
}

$slotName = @{ "1" = "Armor"; "2" = "Kit"; "3" = "Gloves" }
# Confirm part types from id tokens and override if the id disagrees.
function Slot-Of($id, $partType) {
    if ($id -match '_body_') { return "Armor" }
    if ($id -match '_hand_') { return "Gloves" }
    if ($id -match '_edc_') { return "Kit" }
    if ($slotName.ContainsKey([string]$partType)) { return $slotName[[string]$partType] }
    return "Gear"
}

$gearList = @()
foreach ($ep in $equips.PSObject.Properties) {
    $e = $ep.Value
    $stats = @()
    $base = $e.displayBaseAttrModifier
    if ($base -and [double]$base.attrValue -ne 0) {
        $stats += [ordered]@{
            stat = "Defense"
            value = (Round4 $base.attrValue)
            mod = [int]$base.modifierType
        }
    }
    foreach ($m in $e.displayAttrModifiers) {
        if ([double]$m.attrValue -eq 0) { continue }
        $stat = [string]$m.packAttrType
        if (-not $stat) { $stat = "Attr$($m.attrType)" }
        $stats += [ordered]@{
            stat  = $stat
            value = (Round4 $m.attrValue)
            mod   = [int]$m.modifierType
        }
    }
    $gearList += [ordered]@{
        id    = $ep.Name
        slot  = (Slot-Of $ep.Name $e.partType)
        level = [int]$e.minWearLv
        suit  = [string]$e.suitID
        stats = $stats
    }
}

$setList = @()
foreach ($sp in $suits.PSObject.Properties) {
    $row = $sp.Value.list | Select-Object -First 1
    if (-not $row) { continue }
    $setList += [ordered]@{
        id   = $sp.Name
        name = (L $row.suitName)
        skill = [string]$row.skillID
    }
}

# Cross-checks against Warfarin (English/Korean operator pages) and weapon ATK tables.
function Assert-True($cond, $msg) {
    if (-not $cond) { throw "CHECK FAILED: $msg" }
}
$endmin = $operators | Where-Object { $_.id -eq "chr_0002_endminm" } | Select-Object -First 1
Assert-True ($endmin.levels[0][0] -eq 30) "Endmin L1 base ATK"
Assert-True ($endmin.levels[89][0] -eq 319) "Endmin L90 base ATK 319"
Assert-True ($endmin.main -eq "Agility" -and $endmin.sub -eq "Strength") "Endmin attributes"
$endminSkills = $skillBook[$endmin.id]
$battle = $endminSkills | Where-Object { $_.id -eq "chr_0002_endminm_normal_skill" }
$b9 = $battle.levels | Where-Object { $_.level -eq 9 }
$dmg = $b9.rows | Where-Object { $_.label -eq "DMG Multiplier" -and $_.damage }
Assert-True ($dmg.value -eq 2.8) "Endmin battle skill rank 9 is 280% (Warfarin)"
$yv = $skillBook["chr_0017_yvonne"] | Where-Object { $_.kind -eq "battle" } | Select-Object -First 1
$y9 = $yv.levels | Where-Object { $_.level -eq 9 }
$yBase = $y9.rows | Where-Object { $_.label -match 'Base DMG' }
Assert-True ($yBase.value -eq 2.0) "Yvonne battle skill rank 9 base 200% (Warfarin)"
$six = $weaponList | Where-Object { $_.id -eq "wpn_claym_0017" }
Assert-True ($six.atk[89] -eq 510) "6-star greatsword L90 ATK 510"
$hot = $gearList | Where-Object { $_.id -eq "item_equip_t4_suit_fire_natr01_edc_03" }
$ai = $hot.stats | Where-Object { $_.stat -eq "PhysicalAndSpellInflictionEnhance" }
Assert-True ($ai.value -eq 41.4) "Level 70 kit Arts Intensity 41.4 (wiki gear table)"

$payload = [ordered]@{
    source = "Game tables mirrored 2026-11-05 (Endfield 1.6). Skill multipliers checked against Warfarin. Damage formula from the Endfield Talos Wiki."
    operators = $operators
    skills = $skillBook
    weapons = $weaponList
    gear = $gearList
    sets = $setList
}

$json = $payload | ConvertTo-Json -Depth 12 -Compress
$jsonPath = Join-Path $outDir "game.json"
[IO.File]::WriteAllText($jsonPath, $json, [Text.UTF8Encoding]::new($false))
$js = "window.GAME_DATA = " + $json + ";"
[IO.File]::WriteAllText((Join-Path $outDir "game.js"), $js, [Text.UTF8Encoding]::new($false))
Write-Output "Wrote $($json.Length) chars"
Write-Output "Operators $($operators.Count)  Weapons $($weaponList.Count)  Gear $($gearList.Count)  Sets $($setList.Count)"
Write-Output "Classes: $(($classByProf.Values | Sort-Object) -join ', ')"
Write-Output "Set names:"
$setList | ForEach-Object { Write-Output ("  {0} = {1}" -f $_.id, $_.name) }
