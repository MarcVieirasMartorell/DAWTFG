using dawrpg_api.Repositories;
using Microsoft.AspNetCore.Mvc;

namespace dawrpg_api.Controllers;

[ApiController]
[Route("api/social")]
public class SocialController(SocialRepository social) : ControllerBase
{
    [HttpPost("follow")]
    public async Task<IActionResult> Follow([FromQuery] int followerId, [FromQuery] int targetId)
    {
        if (followerId <= 0 || targetId <= 0 || followerId == targetId)
            return BadRequest(new { error = "Invalid follow request." });
        await social.Follow(followerId, targetId);
        return NoContent();
    }

    [HttpDelete("unfollow")]
    public async Task<IActionResult> Unfollow([FromQuery] int followerId, [FromQuery] int targetId)
    {
        await social.Unfollow(followerId, targetId);
        return NoContent();
    }

    [HttpGet("following/{accountId:int}")]
    public async Task<IActionResult> GetFollowing(int accountId)
    {
        var list = await social.GetFollowing(accountId);
        return Ok(list);
    }

    [HttpGet("followers/{accountId:int}")]
    public async Task<IActionResult> GetFollowers(int accountId)
    {
        var list = await social.GetFollowers(accountId);
        return Ok(list);
    }

    [HttpGet("following-ids/{accountId:int}")]
    public async Task<IActionResult> GetFollowingIds(int accountId)
    {
        var ids = await social.GetFollowingIds(accountId);
        return Ok(ids);
    }

    [HttpGet("is-following")]
    public async Task<IActionResult> IsFollowing([FromQuery] int followerId, [FromQuery] int targetId)
    {
        var result = await social.IsFollowing(followerId, targetId);
        return Ok(new { following = result });
    }
}
