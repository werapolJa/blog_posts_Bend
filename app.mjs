import express from 'express';
import cors from 'cors'


const app =express();
const port = process.env.express || 4001;

app.use(cors())
app.get("/profiles",(req,res)=>{
    return res.json({
        "data":  {
            "name": "john",
            "age": 20
        }
      
    })
})


app.listen(port,()=>{
    console.log(`Server is running at ${port}`);
    
})