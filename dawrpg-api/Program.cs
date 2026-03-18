using Dapper;
using dawrpg_api.Data;
using dawrpg_api.Repositories;
using dawrpg_api.Services;

// Register snake_case → PascalCase column mapping for all model types
static SqlMapper.ITypeMap SnakeCaseMap(Type t) =>
    new CustomPropertyTypeMap(t, (type, col) =>
        type.GetProperties().FirstOrDefault(p =>
            string.Equals(p.Name, col.Replace("_", ""), StringComparison.OrdinalIgnoreCase)));

foreach (var type in typeof(dawrpg_api.Models.Account).Assembly.GetTypes()
    .Where(t => t.Namespace == "dawrpg_api.Models" && t.IsClass && !t.IsAbstract))
    SqlMapper.SetTypeMap(type, SnakeCaseMap(type));

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new() { Title = "DAW RPG API", Version = "v1" });
});

builder.Services.AddSingleton<IDbConnectionFactory, MySqlConnectionFactory>();
builder.Services.AddScoped<AuthRepository>();
builder.Services.AddScoped<ProgressRepository>();
builder.Services.AddScoped<ReferenceRepository>();
builder.Services.AddScoped<ModRepository>();
builder.Services.AddScoped<AdminRepository>();
builder.Services.AddScoped<SocialRepository>();
builder.Services.AddScoped<SettingsRepository>();
builder.Services.AddScoped<IEmailService, GmailEmailService>();

var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
    ?? ["http://localhost:5173"];

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
        policy.WithOrigins(allowedOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod());
});

var app = builder.Build();

app.UseSwagger();
app.UseSwaggerUI(c => c.SwaggerEndpoint("/swagger/v1/swagger.json", "DAW RPG API v1"));

app.UseCors();
app.UseAuthorization();
app.MapControllers();

app.Run();
