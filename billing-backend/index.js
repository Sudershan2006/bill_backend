const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const db = new sqlite3.Database('./billing.db', (err) => {
    if (err) {
      console.error("Could not connect to database:", err.message);
    } else {
      console.log("Connected to SQLite database.");
    }
  });

  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        date DATE NOT NULL,
        totalAmount REAL NOT NULL
      )
    `);
  
    db.run(`
      CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        orderId INTEGER NOT NULL,
        productId INTEGER NOT NULL,
        name INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        price INTEGER NOT NULL,
        FOREIGN KEY (orderId) REFERENCES orders(id),
        FOREIGN KEY (productId) REFERENCES products(id)
      )
    `);

    // console.log(db.run('.schema order_items'));
    db.run(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        price REAL NOT NULL
      )
    `);

  //   const sampleOrders = [
  //       { totalAmount: 100.00 },
  //       { totalAmount: 200.50 },
  //   ];

  //   const sampleOrderItems = [
  //       { orderId: 1, itemName: 'Item A', quantity: 2, price: 25.00 },
  //       { orderId: 1, itemName: 'Item B', quantity: 1, price: 50.00 },
  //       { orderId: 2, itemName: 'Item C', quantity: 3, price: 60.00 },
  //       { orderId: 2, itemName: 'Item D', quantity: 2, price: 70.25 },
  //   ];

  //   const prodItems = [
  //      {name:'Item A', quantity :3,price:300.00},
  //      {name:'Item B', quantity :3,price:400.00},
  //      {name:'Item C', quantity :3,price:500.00}
  //   ]

  //   // Insert sample orders
  //   const orderStmt = db.prepare('INSERT INTO orders (totalAmount) VALUES (?)');
  //   sampleOrders.forEach(order => {
  //       orderStmt.run(order.totalAmount);
  //   });
  //   orderStmt.finalize();

  //   // Insert sample order items
  //   const item1Stmt = db.prepare('INSERT INTO order_items (orderId, itemName, quantity, price) VALUES (?, ?, ?, ?)');
  //   sampleOrderItems.forEach(item => {
  //       item1Stmt.run(item.orderId, item.itemName, item.quantity, item.price);
  //   });
  //   item1Stmt.finalize();

  //   const prodStmt = db.prepare('INSERT INTO products (name, quantity, price) VALUES (?, ?, ?)');
  //   prodItems.forEach(item => {
  //       prodStmt.run(item.name, item.quantity, item.price);
  //   });
  //   prodStmt.finalize();
  });

  app.post('/api/orders', (req, res) => {
    const { orderType,date,totalAmount,items } = req.body;
  
    // Calculate total amount based on items
    // const totalAmount = items.reduce((total, item) => total + (item.quantity * item.price), 0);
  
    // Insert new order
    const stmt = db.prepare('INSERT INTO orders (type,date,totalAmount) VALUES (?,?,?)');
    stmt.run(orderType,date,totalAmount, function (err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
  
      const orderId = this.lastID;
  
      // Insert order items
      const itemStmt = db.prepare('INSERT INTO order_items (orderId,productId,name,quantity,price) VALUES (?, ?, ?, ?, ?)');
      JSON.parse(items).forEach(item => {
        itemStmt.run(orderId, item.id,item.name,parseInt(item.quantity),item.price);
      });
      itemStmt.finalize();
  
      res.status(201).json({ orderId, totalAmount });
    });
  });

// Route to get all orders
app.get('/api/orders', (req, res) => {
    db.all('SELECT * FROM orders', [], (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(rows);
    });
  });
app.get('/api/orderlist', (req, res) => {
    db.all('SELECT * FROM order_items', [], (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(rows);
    });
  });

// Route to get details of a specific order
app.get('/api/orders/:id', (req, res) => {
    const { id } = req.params;
  
    db.get('SELECT * FROM orders WHERE id = ?', [id], (err, order) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      } else if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }
  
      db.all('SELECT * FROM order_items WHERE orderId = ?', [id], (err, items) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        res.json({ order, items });
      });
    });
  });


// Route to update an order's items
app.put('/api/orders/:id', (req, res) => {
    const { id } = req.params;
    const { items } = req.body;
  
    // Recalculate total amount
    const totalAmount = items.reduce((total, item) => total + (item.quantity * item.price), 0);
  
    // Update order totalAmount
    const stmt = db.prepare('UPDATE orders SET totalAmount = ? WHERE id = ?');
    stmt.run(totalAmount, id, (err) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
  
      // Remove old items and insert new ones
      db.run('DELETE FROM order_items WHERE orderId = ?', [id], (err) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
  
        const itemStmt = db.prepare('INSERT INTO order_items (orderId, itemName, quantity, price) VALUES (?, ?, ?, ?)');
        items.forEach(item => {
          itemStmt.run(id, item.name, item.quantity, item.price);
        });
        itemStmt.finalize();
        res.json({ orderId: id, totalAmount });
      });
    });
  });


app.get('/api/products',(req,res)=>{
  db.all('SELECT * FROM products',[],(err,rows)=>{
    if(err){
      res.status(500).json({error:err.message})
    }
    res.json(rows);
  })
})

app.post('/api/products',(req,res)=>{
  // console.log(req.body);
  const { option,data } =req.body;
  if(option == 'add'){
    const stmt = db.prepare('INSERT INTO products (name,price) VALUES (?,?)');
    // console.log(data.name+" "+data.quantity+' '+data.price);
    stmt.run(data.name,data.price);
    stmt.finalize();
    res.json('Success');
  }
  else if (option == 'edit'){
      const data1 = data.newProduct;
      const fields = Object.keys(data1).map(key => `${key} = ?`).join(', ');
      const values = Object.values(data1);
      const stmt = db.prepare(`UPDATE products SET ${fields} WHERE id = ?`);
      stmt.run([...values, data.id]);
      stmt.finalize();
      res.status(200).json({ success: true, message: 'Product updated successfully' });
  }
  else{
    const stmt = db.prepare('DELETE FROM products WHERE id = ?');
    stmt.run(data);
    stmt.finalize();
    res.status(200).json({ success: true, message: 'Product deleted successfully' });
  }
});

// app.put('/api/products/:id',(req, res) => {
//   const { id } = req.params;
//   const { option, data } = req.body;

//   try {
//       if (option === 'delete') {
//           const stmt = db.prepare('DELETE FROM products WHERE id = ?');
//           stmt.run(id);
//           stmt.finalize();
//           return res.status(200).json({ success: true, message: 'Product deleted successfully' });
//       } else {
//           // Constructing dynamic query for updates
//           const fields = Object.keys(data).map(key => `${key} = ?`).join(', ');
//           const values = Object.values(data);

//           const stmt = db.prepare(`UPDATE products SET ${fields} WHERE id = ?`);
//           stmt.run([...values, id]);
//           stmt.finalize();
//           return res.status(200).json({ success: true, message: 'Product updated successfully' });
//       }
//   } catch (err) {
//       console.error(err);
//       return res.status(500).json({ success: false, error: err.message });
//   }
// });

  // Start thxe server
const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
