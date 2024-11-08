
import express from "express";
import cors from "cors";
import {pool}  from "./utils/db.mjs";

const app = express();
const port = process.env.PORT || 4001;

app.use(cors());
app.use(express.json());

app.get("/profiles",(req,res)=>{
    return res.json({
        "data":  {
            "name": "john",
            "age": 20
        }
      
    })
})

app.get("/assignments",async(req,res)=>{
  let result;
  try {
    result = await pool.query("select * from posts");
    console.log(result.rows);
    
  } catch (error) {
    return res.json({
      message: "ไม่สามารถเชื่อมต่อ Database ได้",
    });
  }
  return res.json({
    data: result.rows,
  });
})


app.post("/assignments",async(req,res)=>{
  const newPost = {
    ...req.body
  }
 
  
  if(!newPost.title || !newPost.image  || !newPost.category_id  || !newPost.description  || !newPost.content  || !newPost.status_id){
    return res.status(400).json({ "message": "Server could not create post because there are missing data from client" })
  }

  console.log(newPost);
  
  try {

    await pool.query(`INSERT INTO posts (title,image,category_id,description,content,status_id) values($1,$2,$3,$4,$5,$6)`,[newPost.title,newPost.image,newPost.category_id,newPost.description,newPost.content,newPost.status_id]);
 
  } catch (error) {
    return res.status(500).res.json( { "message": "Server could not create post because database connection" });
  }
  return res.status(201).res.json({
    message:"Created post sucessfully"
  });
})




app.listen(port, () => {
  console.log(`Server is running at ${port}`);
});
