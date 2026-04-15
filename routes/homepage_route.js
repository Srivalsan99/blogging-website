const cheerio = require('cheerio');

const express = require("express");
const router = express.Router();
const path = require("path");

const db_query = require(path.join(__dirname, "database/db_connection"));
const { getLikeInfo } = require("./database/likeHelper");

function formatDOB(date) {
    if (!date) return null;

    return new Date(date).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}

router.post("/deleteuser/:userid", async (req, res) => {
    try {
        const userid = req.params.userid;

        if (!req.session.isLoggedIn || req.session.user !== userid) {
            return res.status(403).send("Unauthorized");
        }

        // Delete user's likes
        await db_query.queryData(`DELETE FROM wb_blog_likes WHERE userid = ?`, [userid]);

        // Delete user's OWN blogs first
        await db_query.queryData(`DELETE FROM wb_blog_detail_data WHERE userid = ?`, [userid]);
        await db_query.queryData(`DELETE FROM wb_blog_metadata WHERE ownedby = ?`, [userid]);

        // Get all remaining blog details that have comments
        const allBlogs = await db_query.queryData(
            `SELECT blogid, comments FROM wb_blog_detail_data WHERE comments IS NOT NULL`
        );

        for (const blog of allBlogs) {
            if (!blog.comments) continue;

            // Load the HTML into Cheerio
            const $ = cheerio.load(blog.comments, null, false);

            let modified = false;

            // Find every comment block
            $('.comment-content').each((i, el) => {
                const commentAuthor = $(el).find('.comment-user').first().text();

                if (commentAuthor === userid) {
                    $(el).remove(); // Remove the comment and all its nested replies
                    modified = true;
                }
            });

            // Condition to, update the database comment
            if (modified) {
                await db_query.queryData(
                    `UPDATE wb_blog_detail_data SET comments = ? WHERE blogid = ?`,
                    [$.html(), blog.blogid]
                );
            }
        }

        // Finally, delete the user record
        await db_query.queryData(`DELETE FROM wb_user_details WHERE userid = ?`, [userid]);

        req.session.destroy(() => {
            res.clearCookie('connect.sid');
            res.redirect("/account/login?accountDeleted=1");
        });

    } catch (err) {
        console.error("Delete Account Error:", err);
        res.status(500).send("Error deleting account");
    }
});


router.get("/read/:id", async (req, res) => {
    const blogid = req.params.id;
    const loggedUser = req.session.user || null;

    const blog = await db_query.queryData(
        `SELECT md.blogid, md.blogtitle, md.blogdatetime, md.ownedby, dd.blogcontent
         FROM wb_blog_metadata md
         JOIN wb_blog_detail_data dd ON md.blogid = dd.blogid
         WHERE md.blogid = ?`,
        [blogid]
    );

    if (!blog.length) return res.status(404).send("Blog not found");

    const likeInfo = await getLikeInfo(blogid, loggedUser);

    res.render("blogcontent/blogview", {
        title: blog[0].blogtitle,
        author: blog[0].ownedby,
        date: blog[0].blogdatetime,
        content: blog[0].blogcontent,
        blogid: blog[0].blogid,
        user: loggedUser,
        likeCount: likeInfo.likeCount,
        userLiked: likeInfo.userLiked
    });
});


router.post('/like/:blogid', async (req, res) => {
    if (!req.session.isLoggedIn) {
        return res.status(401).json({ error: 'Login required' });
    }

    const blogid = req.params.blogid;
    const userid = req.session.user;

    const existing = await db_query.queryData(
        `SELECT 1 FROM wb_blog_likes WHERE blogid = ? AND userid = ?`,
        [blogid, userid]
    );

    if (existing.length) {
        await db_query.queryData(
            `DELETE FROM wb_blog_likes WHERE blogid = ? AND userid = ?`,
            [blogid, userid]
        );
        return res.json({ liked: false });
    } else {
        await db_query.queryData(
            `INSERT INTO wb_blog_likes (blogid, userid) VALUES (?, ?)`,
            [blogid, userid]
        );
        return res.json({ liked: true });
    }
});


router.post("/delete/:id", async (req, res) => {
    try {
        if (!req.session.isLoggedIn) {
            return res.redirect("/account/login");
        }

        const user = req.session.user;
        const blogid = req.params.id;

        // Delete child table first
        await db_query.queryData(
            `DELETE FROM wb_blog_detail_data
             WHERE blogid = ? AND userid = ?`,
            [blogid, user]
        );

        // Delete parent table
        await db_query.queryData(
            `DELETE FROM wb_blog_metadata
             WHERE blogid = ? AND ownedby = ?`,
            [blogid, user]
        );

        return res.redirect("/homepage/profile?deleted=1");

    } catch (err) {
        console.error("Delete error:", err);
        return res.redirect("/homepage/profile?error=1");
    }
});


router.get("/edit/:id", async (req, res) => {
    if (!req.session.isLoggedIn) {
        return res.redirect("/account/login");
    }
    const user = req.session.user;

    const blogid = req.params.id;
    const blogHistory = await db_query.queryData(
     `select md.blogtitle,md.blogdatetime,dd.blogcontent  from wb_blog_metadata md
            left join wb_blog_detail_data dd
             on md.blogid=dd.blogid and md.ownedby = dd.userid
             where md.blogid=? and md.ownedby=?`,
        [blogid,user]
    );

    const heading= blogHistory[0].blogtitle || false;
    const body= blogHistory[0].blogcontent || false;
    // console.log(heading)
    // console.log(body)
    res.render("blogcontent/edit",{
        blogid: blogid,
        heading:heading,
        content: body
    })
})


router.get("/profile", async (req, res) => {
    try {
        if (!req.session.isLoggedIn) {
            return res.redirect("/account/login");
        }

        const user = req.session.user;

        // USER PROFILE
        const userRows = await db_query.queryData(
            `SELECT
                 wud.userid,
                 wud.real_name,
                 wud.description,
                 wud.dob,
                 wa.image
             FROM wb_user_details wud
                      LEFT JOIN wb_avatar wa ON wa.avatarid = wud.avatarid
             WHERE wud.userid = ?`,
            [user]
        );

        if (!userRows || userRows.length === 0) {
            return res.status(404).send("User not found");
        }

        const profile = userRows[0];

        const img = profile.image
            ? `data:image/png;base64,${profile.image.toString("base64")}`
            : null;

        const formattedDOB = formatDOB(profile.dob);

        // BLOG HISTORY
        const blogHistory = await db_query.queryData(
            `
                SELECT
                    md.blogid,
                    md.blogtitle,
                    md.blogdatetime,
                    COUNT(bl.userid) AS likeCount,
                    SUM(bl.userid = ?) AS userLiked
                FROM wb_blog_metadata md
                         LEFT JOIN wb_blog_likes bl ON md.blogid = bl.blogid
                WHERE md.ownedby = ?
                GROUP BY md.blogid
                ORDER BY md.blogdatetime DESC
            `,
            [user, user]
        );

        // const blogid = blogHistory[0].blogid;

        const blogRecord = blogHistory.map(blog => ({
            id: blog.blogid,
            title: blog.blogtitle,
            date: new Date(blog.blogdatetime),
            likeCount: blog.likeCount,
            userLiked: blog.userLiked > 0
        }));




        res.render("blogcontent/profilepage", {
            image: img,
            userid: profile.userid,
            real_name: profile.real_name,
            description: profile.description || "No Description",
            dob: formattedDOB,
            blogPublished: blogRecord
        });


    } catch (err) {
        console.error(err);
        res.status(500).send("Profile page error");
    }
});

router.post('/publish', async (req, res) => {
    try {
        if (!req.session.isLoggedIn) {
            return res.redirect("/account/login");
        }
        const {  heading,content } = req.body;
        const user = req.session.user;

        // Server-side validation
        if (!heading || !content || !user) {
        // if (!content) {

        return res.redirect("/homepage/create?error=1");
        }

    //     // Insert into metadata
        const metaResult = await db_query.queryData(
            `INSERT INTO sp959.wb_blog_metadata (ownedby, blogtitle, blogdatetime)
             VALUES (?, ?, NOW())`,
            [user, heading]
        );

        const blogid = metaResult.insertId;

    //     // Insert into detail
        await db_query.queryData(
            `INSERT INTO sp959.wb_blog_detail_data (blogid, userid, blogcontent)
       VALUES (?, ?, ?)`,
            [blogid, user, content]
        );
        return res.redirect("/homepage/create?success=1");
    } catch (err) {
        console.log(err);
        return res.redirect("/homepage/create?error=1");
    }
});


router.post('/confirmChange', async (req, res) => {
    try {
        if (!req.session.isLoggedIn) {
            return res.redirect("/account/login");
        }

        const { blogid, heading, content } = req.body;
        const user = req.session.user;

        // Validation
        if (!blogid || !heading || !content) {
            return res.redirect("/homepage/profile?error=1");
        }

        //  Update metadata (title only)
        await db_query.queryData(
            `UPDATE sp959.wb_blog_metadata
             SET blogtitle = ?
             WHERE blogid = ? AND ownedby = ?`,
            [heading, blogid, user]
        );

        //  Update blog content
        await db_query.queryData(
            `UPDATE sp959.wb_blog_detail_data
             SET blogcontent = ?
             WHERE blogid = ? AND userid = ?`,
            [content, blogid, user]
        );

        return res.redirect("/homepage/profile?updated=1");

    } catch (err) {
        console.error(err);
        return res.redirect("/homepage/profile?error=1");
    }
});

// Fetch saved comments HTML for a blog
router.get('/commentsU/:blogid', async (req, res) => {
    try {
        const blogid = req.params.blogid;

        const rows = await db_query.queryData(
            `SELECT comments
             FROM wb_blog_detail_data
             WHERE blogid = ?
             LIMIT 1`,
            [blogid]
        );

        if (!rows || rows.length === 0) {
            return res.json({ html: "" });
        }

        res.json({
            html: rows[0].comments || ""
        });

    } catch (err) {
        console.error("Fetch comments error:", err);
        res.status(500).json({ html: "" });
    }
});


router.post('/comments', async (req, res) => {
    try {
        const { blogid, userid, html } = req.body;

        //  just log
        console.log('Received comments:', { blogid, userid, html });


        await db_query.queryData(
            `UPDATE wb_blog_detail_data
             SET comments = ?
             WHERE blogid = ?`,
            [html, blogid]
        );
        //
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: err.message });
    }
});

router.get("/create", async (req, res) => {
  const { success, error } = req.query;
    if (!req.session.isLoggedIn) {
        return res.redirect("/account/login");
    }
  res.render("blogcontent/content", {
    success: success || null,
    error: error || null
  });
});

router.post('/toggle-comments/:blogid', async (req, res) => {
    if (!req.session.isLoggedIn) {
        return res.status(401).json({ success: false });
    }

    const user = req.session.user;
    const { enabled } = req.body;

    await db_query.queryData(
        `UPDATE wb_blog_metadata
         SET comments_enabled = ?
         WHERE blogid = ? AND ownedby = ?`,
        [enabled, req.params.blogid, user]
    );

    res.json({ success: true });
});


router.get("/read/:id", async (req, res) => {
    try {

        // if (!req.session.isLoggedIn) {
        //     return res.redirect("/account/login");
        // }
        const blogid = req.params.id;

        const blog = await db_query.queryData(
            `SELECT
                 md.blogid,
                 md.blogtitle,
                 md.blogdatetime,
                 md.ownedby,
                 md.comments_enabled,
                 dd.blogcontent
             FROM wb_blog_metadata md
                      JOIN wb_blog_detail_data dd
                           ON md.blogid = dd.blogid
             WHERE md.blogid = ?`,
            [blogid]
        );

        if (!blog || blog.length === 0) {
            return res.status(404).send("Blog not found");
        }

        const loggedUser = req.session.user;

        res.render("blogcontent/blogview", {
            title: blog[0].blogtitle,
            author: blog[0].ownedby,
            date: blog[0].blogdatetime,
            content: blog[0].blogcontent,
            blogid: blog[0].blogid,
            user: req.session.user,
            commentsEnabled: blog[0].comments_enabled,
            isAuthor: loggedUser === blog[0].ownedby

        });


    } catch (err) {
        console.error(err);
        res.status(500).send("Error loading blog");
    }
});


module.exports = router;
