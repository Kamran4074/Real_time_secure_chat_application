import 'dotenv/config' // must be first so env is loaded before app.js reads it
import dbConnect from "./DB/dbConnect.js";
import {server} from './app.js'

if(!process.env.JWT_SECRET || !process.env.MONGODB_CONNECT){
    console.error("JWT_SECRET and MONGODB_CONNECT must be set");
    process.exit(1);
}

const PORT = process.env.PORT || 3000

// Connect to the database before accepting requests
await dbConnect();
server.listen(PORT,()=>{
    console.log(`Working at ${PORT}`);
})
