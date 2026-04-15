const path = require("path");
const db_query = require(path.join(__dirname, "db_connection"));

async function getLikeInfo(blogid, userid) {
    const result = await db_query.queryData(
        `
            SELECT
                COUNT(userid) AS likeCount,
                SUM(userid = ?) AS userLiked
            FROM wb_blog_likes
            WHERE blogid = ?
        `,
        [userid, blogid]
    );

    if (!result || result.length === 0) {
        return { likeCount: 0, userLiked: false };
    }

    return {
        likeCount: result[0].likeCount,
        userLiked: result[0].userLiked > 0
    };
}

module.exports = { getLikeInfo };
