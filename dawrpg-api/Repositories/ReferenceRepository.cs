using Dapper;
using dawrpg_api.Data;
using dawrpg_api.Models;

namespace dawrpg_api.Repositories;

file class NodeEnemyRow
{
    public string WorldId  { get; set; } = "";
    public string NodeId   { get; set; } = "";
    public int    Position { get; set; }
    public string EnemyKind{ get; set; } = "";
}

public class ReferenceRepository(IDbConnectionFactory db)
{
    public async Task<List<Hero>> GetHeroes()
    {
        using var conn = db.Create();
        var heroes = (await conn.QueryAsync<Hero>("SELECT * FROM heroes ORDER BY id")).ToList();
        var scripts = (await conn.QueryAsync<HeroScript>("SELECT * FROM hero_scripts ORDER BY hero_id, id")).ToList();

        foreach (var hero in heroes)
            hero.Scripts = scripts.Where(s => s.HeroId == hero.Id).ToList();

        return heroes;
    }

    public async Task<Hero?> GetHero(string id)
    {
        using var conn = db.Create();
        var hero = await conn.QuerySingleOrDefaultAsync<Hero>(
            "SELECT * FROM heroes WHERE id = @id", new { id });

        if (hero is null) return null;

        hero.Scripts = (await conn.QueryAsync<HeroScript>(
            "SELECT * FROM hero_scripts WHERE hero_id = @id ORDER BY id",
            new { id })).ToList();

        return hero;
    }

    public async Task<List<Item>> GetItems()
    {
        using var conn = db.Create();
        return (await conn.QueryAsync<Item>("SELECT * FROM items ORDER BY id")).ToList();
    }

    public async Task<Item?> GetItem(string id)
    {
        using var conn = db.Create();
        return await conn.QuerySingleOrDefaultAsync<Item>(
            "SELECT * FROM items WHERE id = @id", new { id });
    }

    public async Task<List<Enemy>> GetEnemies()
    {
        using var conn = db.Create();
        return (await conn.QueryAsync<Enemy>("SELECT * FROM enemies ORDER BY display_no")).ToList();
    }

    public async Task<Enemy?> GetEnemy(string id)
    {
        using var conn = db.Create();
        return await conn.QuerySingleOrDefaultAsync<Enemy>(
            "SELECT * FROM enemies WHERE id = @id", new { id });
    }

    public async Task<List<World>> GetWorlds()
    {
        using var conn = db.Create();
        var worlds = (await conn.QueryAsync<World>("SELECT * FROM worlds ORDER BY id")).ToList();
        var nodes = (await conn.QueryAsync<WorldNode>("SELECT * FROM world_nodes ORDER BY world_id, node_id")).ToList();
        var edges = (await conn.QueryAsync<WorldEdge>("SELECT * FROM world_edges ORDER BY world_id")).ToList();
        var nodeEnemies = (await conn.QueryAsync<NodeEnemyRow>(
            "SELECT world_id, node_id, position, enemy_kind FROM node_enemies ORDER BY world_id, node_id, position")).ToList();

        foreach (var node in nodes)
            node.Enemies = nodeEnemies
                .Where(ne => ne.WorldId == node.WorldId && ne.NodeId == node.NodeId)
                .OrderBy(ne => ne.Position)
                .Select(ne => ne.EnemyKind)
                .ToList();

        foreach (var world in worlds)
        {
            world.Nodes = nodes.Where(n => n.WorldId == world.Id).ToList();
            world.Edges = edges.Where(e => e.WorldId == world.Id).ToList();
        }

        return worlds;
    }

    public async Task<World?> GetWorld(string id)
    {
        using var conn = db.Create();
        var world = await conn.QuerySingleOrDefaultAsync<World>(
            "SELECT * FROM worlds WHERE id = @id", new { id });

        if (world is null) return null;

        var nodes = (await conn.QueryAsync<WorldNode>(
            "SELECT * FROM world_nodes WHERE world_id = @id ORDER BY node_id",
            new { id })).ToList();

        var edges = (await conn.QueryAsync<WorldEdge>(
            "SELECT * FROM world_edges WHERE world_id = @id",
            new { id })).ToList();

        var nodeEnemies = (await conn.QueryAsync<NodeEnemyRow>(
            "SELECT node_id, position, enemy_kind FROM node_enemies WHERE world_id = @id ORDER BY node_id, position",
            new { id })).ToList();

        foreach (var node in nodes)
            node.Enemies = nodeEnemies
                .Where(ne => ne.NodeId == node.NodeId)
                .OrderBy(ne => ne.Position)
                .Select(ne => ne.EnemyKind)
                .ToList();

        world.Nodes = nodes;
        world.Edges = edges;
        return world;
    }
}
