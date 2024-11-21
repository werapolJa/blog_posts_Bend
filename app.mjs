import express from "express";
import cors from "cors";
import { connectionPool } from "./utils/db.mjs";

const app = express();
const port = process.env.PORT || 4001;
app.use(express.json());
app.use(cors());


app.get("/test",(req,res)=>{
  return res.json({message:"werapol"})
})
app.get("/profiles", (req, res) => {
  return res.json({
    data: {
      name: "john",
      age: 20,
    },
  });
});

app.get("/assignments", async (req, res) => {
  let result;
  try {
    result = await connectionPool.query("select * from posts");
    console.log(result.rows);
  } catch (error) {
    return res.json({
      message: "ไม่สามารถเชื่อมต่อ Database ได้",
    });
  }
  return res.json({
    data: result.rows,
  });
});

app.post("/assignments", async (req, res) => {
  const newPost = {
    ...req.body,
  };

  if (
    !newPost.title ||
    !newPost.image ||
    !newPost.category_id ||
    !newPost.description ||
    !newPost.content ||
    !newPost.status_id
  ) {
    return res
      .status(400)
      .json({
        message:
          "Server could not create post because there are missing data from client",
      });
  }

  console.log(newPost);

  try {
    await connectionPool.query(
      `INSERT INTO posts (title,image,category_id,description,content,status_id) values($1,$2,$3,$4,$5,$6)`,
      [
        newPost.title,
        newPost.image,
        newPost.category_id,
        newPost.description,
        newPost.content,
        newPost.status_id,
      ]
    );
  } catch (error) {
    return res
      .status(500)
      .res.json({
        message: "Server could not create post because database connection",
      });
  }
  return res.status(201).res.json({
    message: "Created post sucessfully",
  });
});

app.get("/posts", async (req, res) => {
  // console.log(req);

  try {
    // 1) Access ข้อมูลใน Body จาก Request ด้วย req.body
    const category = req.query.category || "";
    // console.log(category);

    const keyword = req.query.keyword || "";
    // console.log(keyword);
    const page = Number(req.query.page) || 1;

    const limit = Number(req.query.limit) || 6;

    // 2) ทำให้แน่ใจว่า query parameter page และ limit จะมีค่าอย่างต่ำเป็น 1
    const safePage = Math.max(1, page);
    const safeLimit = Math.max(1, Math.min(100, limit));
    const offset = (safePage - 1) * safeLimit;
    // offset คือค่าที่ใช้ในการข้ามจำนวนข้อมูลบางส่วนตอน query ข้อมูลจาก database
    // ถ้า page = 2 และ limit = 6 จะได้ offset = (2 - 1) * 6 = 6 หมายความว่าต้องข้ามแถวไป 6 แถวแรก และดึงแถวที่ 7-12 แทน
    // 3) เขียน Query เพื่อ Insert ข้อมูลโพสต์ ด้วย Connection connectionPool
    let query = `
    SELECT posts.id, posts.image, categories.name AS category, posts.title, posts.description, posts.date, posts.content, statuses.status, posts.likes_count
    FROM posts
    INNER JOIN categories ON posts.category_id = categories.id
    INNER JOIN statuses ON posts.status_id = statuses.id
  `;
    let values = [];
    // 4) เขียน query จากเงื่อนไขของการใส่ query parameter category และ keyword

    if (category && keyword) {
      query += `
      WHERE categories.name ILIKE $1 
      AND (posts.title ILIKE $2 OR posts.description ILIKE $2 OR posts.content ILIKE $2)
    `;
      values = [`%${category}%`, `%${keyword}%`];
    } else if (category) {
      query += " WHERE categories.name ILIKE $1";
      values = [`%${category}%`];
    } else if (keyword) {
      query += `
      WHERE posts.title ILIKE $1 
      OR posts.description ILIKE $1 
      OR posts.content ILIKE $1
    `;
      values = [`%${keyword}%`];
    }
  
    // 5) เพิ่มการ odering ตามวันที่, limit และ offset
    query += ` ORDER BY posts.date DESC LIMIT $${values.length + 1} OFFSET $${
      values.length + 2
    }`;

  
    
    values.push(safeLimit, offset);
  
    // 6) Execute the main query (ดึงข้อมูลของบทความ)
    const result = await connectionPool.query(query, values);
    console.log(query + values);
    // 7) สร้าง Query สำหรับนับจำนวนทั้งหมดตามเงื่อนไข พื่อใช้สำหรับ pagination metadata

    let countQuery = `
    SELECT COUNT(*)
    FROM posts
    INNER JOIN categories ON posts.category_id = categories.id
    INNER JOIN statuses ON posts.status_id = statuses.id
  `;
    let countValues = values.slice(0, -2); // ลบค่า limit และ offset ออกจาก values
    if (category && keyword) {
      countQuery += `
      WHERE categories.name ILIKE $1 
      AND (posts.title ILIKE $2 OR posts.description ILIKE $2 OR posts.content ILIKE $2)
    `;
    } else if (category) {
      countQuery += " WHERE categories.name ILIKE $1";
    } else if (keyword) {
      countQuery += `
      WHERE posts.title ILIKE $1 
      OR posts.description ILIKE $1 
      OR posts.content ILIKE $1
    `;
    }
    const countResult = await connectionPool.query(countQuery, countValues);
    const totalPosts = parseInt(countResult.rows[0].count, 10);
    // 8) สร้าง response พร้อมข้อมูลการแบ่งหน้า (pagination)
    const results = {
      totalPosts,
      totalPages: Math.ceil(totalPosts / safeLimit),
      currentPage: safePage,
      limit: safeLimit,
      posts: result.rows,
    };
    // เช็คว่ามีหน้าถัดไปหรือไม่
    if (offset + safeLimit < totalPosts) {
      results.nextPage = safePage + 1;
    }
    // เช็คว่ามีหน้าก่อนหน้าหรือไม่
    if (offset > 0) {
      results.previousPage = safePage - 1;
    }
    // 9) Return ตัว Response กลับไปหา Client ว่าสร้างสำเร็จ
    return res.status(200).json(results);
  } catch {
    return res.status(500).json({
      message: "Server could not read post because database issue",
    });
  }
});

app.get("/posts/:postId", async (req, res) => {
  const getPostId = req.params.postId;
  // console.log(getPostId);
  try {
    const checkPostId = await connectionPool.query(
      `
        SELECT *
        FROM posts
        WHERE posts.id = $1
        `,
      [getPostId]
    );
    if(!checkPostId.rows[0]){
      return res.status(400).json({message:"no Post"})
    }
 
    const results = await connectionPool.query(
      `
        SELECT posts.id, posts.image, categories.name AS category, posts.title, posts.description, posts.date, posts.content, statuses.status, posts.likes_count
        FROM posts
        INNER JOIN categories ON posts.category_id = categories.id
        INNER JOIN statuses ON posts.status_id = statuses.id
        WHERE posts.id = $1
        `,
      [getPostId]
    );

    if (!results) {
      return res
        .status(404)
        .json({ message: "Server could not find a requested post" });
    }

    return res.status(200).json({ data: results.rows[0] });
  } catch (error) {
    return res
      .status(500)
      .json({
        message: "Server could not read post because database connection",
      });
  }
});

app.put("/posts/:postId", async (req, res) => {
  const updatePostId = req.params.postId;
  const updatePost = { ...req.body };

  try {
    await connectionPool.query(
      `
        UPDATE posts
        SET title = $2,
            image = $3,
            category_id = $4,
            description = $5,
            content = $6,
            status_id = $7,
            date = $8
        WHERE id = $1
      `,
      [
        updatePostId,
        updatePost.title,
        updatePost.image,
        updatePost.category_id,
        updatePost.description,
        updatePost.content,
        updatePost.status_id,
        updatePost.date,
      ]
    );
    return res.status(200).json({
      message: "Updated post successfully",
    });
  } catch (error) {
    console.log(error);
  }
});

app.delete("/posts/:postId", async (req, res) => {
  const deletePostId = req.params.postId;
  // console.log(deletePostId);
  
  try {
    await connectionPool.query(
      `DELETE FROM posts
       WHERE id = $1`,
      [deletePostId]
    );
    return res.status(200).json({message:"Deleted post sucessfully"})
  } catch (error) {
    return res.status(500).json({message:"Server could not delete post because database connection"})
  }
});

app.listen(port, () => {
  console.log(`Server is running at ${port}`);
});
