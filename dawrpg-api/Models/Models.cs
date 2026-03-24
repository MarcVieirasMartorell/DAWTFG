namespace dawrpg_api.Models;

// ── Reference data ────────────────────────────────────────────

public class Hero
{
    public string Id { get; set; } = "";
    public string Role { get; set; } = "";
    public string? Bio { get; set; }
    public int HpMax { get; set; }
    public int CpuMax { get; set; }
    public decimal Spd { get; set; }
    public int AtkMin { get; set; }
    public int AtkMax { get; set; }
    public string LimitName { get; set; } = "";
    public string LimitDesc { get; set; } = "";
    public List<HeroScript> Scripts { get; set; } = [];
}

public class HeroScript
{
    public string Id { get; set; } = "";
    public string HeroId { get; set; } = "";
    public string Label { get; set; } = "";
    public int CpuCost { get; set; }
    public int DmgMin { get; set; }
    public int DmgMax { get; set; }
    public int HealMin { get; set; }
    public int HealMax { get; set; }
    public string Kind { get; set; } = "";
    public string? Extra { get; set; }
    public string? Description { get; set; }
}

public class Item
{
    public string Id { get; set; } = "";
    public string Label { get; set; } = "";
    public string Kind { get; set; } = "";
    public int BattleAmt { get; set; }
    public int Price { get; set; }
    public int SellPrice { get; set; }
    public int Stock { get; set; }
    public string? Glyph { get; set; }
    public string? KindLabel { get; set; }
    public string? Description { get; set; }
}

public class Enemy
{
    public string Id { get; set; } = "";
    public string DisplayNo { get; set; } = "";
    public string? Class { get; set; }
    public string? WhereFound { get; set; }
    public string? Description { get; set; }
    public int Hp { get; set; }
    public decimal Spd { get; set; }
    public int DmgMin { get; set; }
    public int DmgMax { get; set; }
    public int Xp { get; set; }
}

public class World
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string? SubTitle { get; set; }
    public List<WorldNode> Nodes { get; set; } = [];
    public List<WorldEdge> Edges { get; set; } = [];
}

public class WorldNode
{
    public string NodeId { get; set; } = "";
    public string WorldId { get; set; } = "";
    public string NodeType { get; set; } = "";
    public string Label { get; set; } = "";
    public string? SubLabel { get; set; }
    public int XPos { get; set; }
    public int YPos { get; set; }
    public string? EncounterBg { get; set; }
    public int? EncounterTier { get; set; }
    public bool IsBoss { get; set; }
    public List<string> Enemies { get; set; } = [];
}

public class WorldEdge
{
    public string WorldId { get; set; } = "";
    public string NodeFrom { get; set; } = "";
    public string NodeTo { get; set; } = "";
}

// ── User / progress ───────────────────────────────────────────

public class Account
{
    public int Id { get; set; }
    public string Username { get; set; } = "";
    public string? Email { get; set; }
    public bool IsAdmin { get; set; }
    public bool EmailVerified { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime LastLogin { get; set; }
}

public class PlayerProgress
{
    public int AccountId { get; set; }
    public string PlayerName { get; set; } = "";
    public string CurrentWorldId { get; set; } = "w1";
    public int Wallet { get; set; }
    public bool HasSave { get; set; }
    public int PlaytimeSec { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class PlayerPartySlot
{
    public int AccountId { get; set; }
    public int Slot { get; set; }
    public string HeroId { get; set; } = "";
}

public class PlayerInventoryEntry
{
    public int AccountId { get; set; }
    public string ItemId { get; set; } = "";
    public int Quantity { get; set; }
}

public class PlayerClear
{
    public int AccountId { get; set; }
    public string WorldId { get; set; } = "";
    public string NodeId { get; set; } = "";
    public DateTime ClearedAt { get; set; }
}

public class FullPlayerState
{
    public Account Account { get; set; } = new();
    public PlayerProgress Progress { get; set; } = new();
    public List<string> Party { get; set; } = [];
    public List<string> UnlockedHeroes { get; set; } = [];
    public List<string> WorldsUnlocked { get; set; } = [];
    public List<string> Clears { get; set; } = [];
    public Dictionary<string, int> Inventory { get; set; } = [];
}

// ── Community mods ────────────────────────────────────────────

public class CommunityMod
{
    public int Id { get; set; }
    public int AuthorId { get; set; }
    public string AuthorName { get; set; } = "";
    public string Title { get; set; } = "";
    public string? Description { get; set; }
    public string? IntroText { get; set; }
    public string Version { get; set; } = "1.0";
    public bool IsPublished { get; set; }
    public int PlayCount { get; set; }
    public int RatingSum { get; set; }
    public int RatingCount { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class CommunityModWithData : CommunityMod
{
    public string? Data { get; set; }
}
