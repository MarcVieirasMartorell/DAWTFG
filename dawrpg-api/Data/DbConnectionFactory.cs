using MySqlConnector;
using System.Data;

namespace dawrpg_api.Data;

public interface IDbConnectionFactory
{
    IDbConnection Create();
}

public class MySqlConnectionFactory(IConfiguration config) : IDbConnectionFactory
{
    private readonly string _connectionString = config.GetConnectionString("DefaultConnection")
        ?? throw new InvalidOperationException("Connection string 'DefaultConnection' not found.");

    public IDbConnection Create() => new MySqlConnection(_connectionString);
}
