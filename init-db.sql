select * from wb_user_details wud;

-- truncate TABLE wb_user_details
--
SET FOREIGN_KEY_CHECKS = 1;



-- Your database initialisation SQL here
create table sp959.wb_avatar
(
    avatarid int auto_increment
        primary key,
    image    blob null
);


create table sp959.wb_blog_detail_data
(
    blogid      int   ,
    userid      varchar(15)                  not null,
    blogcontent longtext,
    constraint fk_blog_detail_userid
        foreign key (userid) references sp959.wb_user_details (userid),
    constraint fk_blogid_wb_blog_metadata
        foreign key (blogid) references sp959.wb_blog_metadata (blogid)
);

CREATE TABLE wb_blog_comments (
                                  commentid INT AUTO_INCREMENT PRIMARY KEY,
                                  blogid INT NOT NULL,
                                  userid VARCHAR(50) NOT NULL,
                                  parentid INT DEFAULT NULL,
                                  comment_html LONGTEXT NOT NULL,
                                  comment_datetime DATETIME DEFAULT CURRENT_TIMESTAMP,

                                  FOREIGN KEY (blogid) REFERENCES wb_blog_metadata(blogid)
                                      ON DELETE CASCADE
);


create table sp959.wb_blog_metadata
(
    blogid       int auto_increment
        primary key,
    ownedby      varchar(40)                  not null,
    blogtitle    mediumtext                   not null,
    blogdatetime datetime                     not null,
    constraint fk_blogid_userid
        foreign key (ownedby) references sp959.wb_user_details (userid)
);
ALTER TABLE sp959.wb_blog_detail_data
    ADD COLUMN comments LONGTEXT;

CREATE TABLE wb_blog_likes (
                               id INT AUTO_INCREMENT PRIMARY KEY,
                               blogid INT NOT NULL,
                               userid VARCHAR(100) NOT NULL,
                               created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                               UNIQUE KEY unique_like (blogid, userid)
);


create table sp959.wb_comments
(
    commentid varchar(250) not null,
    userid    varchar(15)  not null,
    blogid    int          null,
    comment   longtext     null,
    date      datetime     not null,
    nested    varchar(250) null,
    parent    tinyint(1)   null,
    constraint fk_blog_detail_userid_comment
        foreign key (userid) references sp959.wb_user_details (userid),
    constraint fk_blogid_wb_blog_metadata_comment
        foreign key (blogid) references sp959.wb_blog_metadata (blogid)
);

create table sp959.wb_user_details
(
    userid      varchar(40)  not null
        primary key,
    password    varchar(100) not null,
    real_name   mediumtext   not null,
    dob         date         not null,
    description longtext     not null,
    avatarid    int          null,
    constraint fk_avatarid_wb_avatar
        foreign key (avatarid) references sp959.wb_avatar (avatarid)
);



# INSERT INTO wb_avatar (image) VALUES
# (LOAD_FILE('D:/waikato/web-final-project/images/avatar/avatar1.png')),
# (LOAD_FILE('D:/waikato/web-final-project/images/avatar/avatar2.png')),
# (LOAD_FILE('D:/waikato/web-final-project/images/avatar/avatar3.png')),
# (LOAD_FILE('D:/waikato/web-final-project/images/avatar/avatar4.png')),
# (LOAD_FILE('D:/waikato/web-final-project/images/avatar/avatar5.png')),
# (LOAD_FILE('D:/waikato/web-final-project/images/avatar/avatar6.png'));
#
#
# SET FOREIGN_KEY_CHECKS = 0;
#
# -- 2. Empty the table
# TRUNCATE TABLE wb_avatar;

# select * from wb_avatar;
#
# -- 3. Re-enable the check
# SET FOREIGN_KEY_CHECKS = 1;

# SELECT @@secure_file_priv;

SELECT LOAD_FILE('images/avatar/avatar1.png');

# truncate TABLE wb_blog_detail_data
