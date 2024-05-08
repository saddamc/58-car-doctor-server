const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');  /**token related import */
const cookieParser = require('cookie-parser'); 
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://cars-doctor-7c7d8.web.app',
    'https://cars-doctor-7c7d8.firebaseapp.com'
  ],
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());


console.log(process.env.DB_PASS)
console.log(process.env.DB_USER)

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.m0qpfuk.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

// middleware my (1)
const logger = async(req, res, next) =>{
  // console.log('called', req.host, req.originalUrl);
  console.log('log: info', req.method, req.url);
  next();
}
// middleware my (2)
const verifyToken = async(req, res, next) =>{
  const token = req?.cookies?.token;
  // console.log('value of token in middleware', token)

  // no token available
  if(!token){
    return res.status(401).send({message: 'unauthorized access'})
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    // error
    if(err){
      console.log(err)
      return res.status(401).send({message: 'unauthorized access'})
    }
    // if token is valid then it would be decoded
    console.log('value in the token', decoded)
    req.user = decoded;
    next();
  })
   
}

const cookieOpttion = {
        httpOnly: true,
        // sameSite: 'strict',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
        // secure: false,
        secure: process.env.NODE_ENV === 'production' ? true : false,         
      }

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const serviceCollection = client.db('carDoctor').collection('services');
    const bookingCollection = client.db('carDoctor').collection('bookings');

    // auth related api => 01 (local stroage)
    // app.post('/jwt', logger, async(req, res) => {
    //   const user = req.body;
    //   console.log(user);
    //   const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {expiresIn: '1h'} )
    //   console.log(token)

    //   res
    //   .cookie('token', token, {
    //             httpOnly: true,
    //             secure: process.env.NODE_ENV === 'production', 
    //             sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',

    //         })
    //   .send({success: true});
    // })

    // auth related api => token login & signup => 02
    app.post('/jwt', logger, async(req, res) => {
      const user = req.body;
      console.log('user for token', user )
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })

      res.cookie('token', token, cookieOpttion).send({success: true});
    })
    // continue  02 (need to call form logout (const userEmail = currentUser?.email || user.email;))
    app.post('/logout', async(req, res) => {
      const user = req.body;
      console.log('logging out', user);
      res.clearCookie('token', { ...cookieOpttion, maxAge: 0}).send({success: true})
    })






    // service related api
    app.get('/services', logger, async(req, res) => {
        const cursor = serviceCollection.find();
        const result = await cursor.toArray();
        res.send(result);
    })
    app.get('/services/:id', async(req, res) =>{
        const id = req.params.id;
        const query = {_id: new ObjectId(id)};

        const options = {
            // Include only the `title` and `imdb` fields in the returned document
            projection: { title: 1, price: 1, service_id: 1, img: 1 },
    };

        const result = await serviceCollection.findOne(query,options);
        res.send(result);
    })

    // bookings 
    // 2
    app.get('/bookings', logger, verifyToken, async(req, res) => {
      // user/email waise filter by query
      console.log(req.query.email);
      console.log('token owner info', req.user)  /***  for check => 2  **/
      // console.log('tok tok token', req.cookies.token);  /**for get token in server CMD */
      // console.log('user in the valid token', req.user)   /**in side show data {email: iat: exp:}  */
      // if(req.user.email !== req.query.email){            /**for your token your data */
      //   return res.status(403).send({message: 'forbidden access'})
      // }
      /**user/email waise filter by query */
      let query = {};
      if(req.query?.email){
        query = {email: req.query.email}
      }
      // previous system just in one line
      const result = await bookingCollection.find(query).toArray();
      res.send(result)
    })


    // 1
    app.post('/bookings', async(req, res) => {
        const booking = req.body;
        console.log(booking);
        const result = await bookingCollection.insertOne(booking);
        res.send(result)
    })
    // 4 => app.patch so client server method: "PATCH"
    app.patch('/bookings/:id', async(req, res) => {
      const id = req.params.id;
      const filter = {_id: new ObjectId(id)};
      const updatedBooking = req.body;
      console.log(updatedBooking);
      // new for 
       const updateDoc = {
      $set: {
        // client a o same status 'confirm'
        status: updatedBooking.status
      },
    };
    const result = await bookingCollection.updateOne(filter, updateDoc);
    res.send(result);
    })

    // 3 delete order
    app.delete('/bookings/:id', async(req, res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const result = await bookingCollection.deleteOne(query);
      res.send(result);
    })



    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });      /**need command for deploy */
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('doctor is running')
})

app.listen(port, () => {
    console.log(`Car Doctor Server is running on port ${port} `)
})

