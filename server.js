// server.js - A simple Node.js server for sending web push notifications
// ติดตั้ง dependencies: npm install express web-push body-parser cors

const express = require('express');
const webpush = require('web-push');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());

// ================== VAPID KEYS ==================
// ควรเก็บเป็น Environment Variables ใน Production
const publicVapidKey = 'BBqT2dI697K39K1-0SAiJ0yPLhco0wtVWUMQnzq9NPYhW85gFdkuOSl86fOeDuiE1mUHFble7kUiTPYROk7BBsU';
const privateVapidKey = 'AEa-VGYA3GFVBya7wiPAK-hxx8Qsq1e81VuAZEvhDJk';

webpush.setVapidDetails(
  'mailto:your-email@example.com', // ใช้อีเมลของคุณ
  publicVapidKey,
  privateVapidKey
);

// ================== STORAGE ==================
// **ข้อควรระวัง:** วิธีนี้เก็บข้อมูลในหน่วยความจำเท่านั้น ซึ่งจะหายไปเมื่อเซิร์ฟเวอร์รีสตาร์ท
// ใน Production ควรใช้ฐานข้อมูลจริง เช่น Firebase, MongoDB, หรือ PostgreSQL
// เปลี่ยนโครงสร้างการจัดเก็บเพื่อเก็บ userId ด้วย
let subscriptions = []; // โครงสร้างใหม่: [{ userId: '...', subscription: { ... } }]


// ================== API ROUTES ==================

/**
 * Route สำหรับบันทึก subscription จาก frontend
 * จะรับ userId และ subscription object
 */
app.post('/save-subscription', (req, res) => {
  const { userId, subscription } = req.body;

  if (!userId || !subscription) {
    return res.status(400).json({ message: 'User ID and subscription object are required.' });
  }

  // ค้นหาและลบ subscription เก่าของ user คนนี้ (ถ้ามี) เพื่อป้องกันข้อมูลซ้ำซ้อน
  const existingIndex = subscriptions.findIndex(sub => sub.subscription.endpoint === subscription.endpoint);
  if (existingIndex > -1) {
    subscriptions.splice(existingIndex, 1);
  }
  
  // เพิ่ม subscription ใหม่พร้อม userId
  subscriptions.push({ userId, subscription });
  
  console.log(`Subscription saved or updated for user: ${userId}`);
  res.status(201).json({ message: 'Subscription saved successfully.' });
});

/**
 * Route สำหรับรับคำสั่งเพื่อส่ง Notification
 * สามารถส่งหา Technician ที่ระบุ หรือส่งหาทุกคน (Broadcast)
 */
app.post('/send-notification', (req, res) => {
  // เพิ่ม technicianId เพื่อระบุเป้าหมาย
  const { title, body, url, technicianId } = req.body;
  
  if (!title || !body) {
      return res.status(400).json({ error: 'Title and body are required.' });
  }

  const notificationPayload = JSON.stringify({
    title: title,
    body: body,
    url: url || '/'
  });

  let targetSubscriptions = [];

  if (technicianId) {
    // ส่งหา Technician ที่ระบุเจาะจง
    targetSubscriptions = subscriptions
      .filter(s => String(s.userId) === String(technicianId))
      .map(s => s.subscription);
    console.log(`Sending notification to technician ID: ${technicianId}. Found ${targetSubscriptions.length} subscriptions.`);
  } else {
    // ถ้าไม่ระบุ technicianId จะถือว่าเป็นการส่งหาทุกคน (Broadcast)
    targetSubscriptions = subscriptions.map(s => s.subscription);
    console.log(`Broadcasting notification to all ${targetSubscriptions.length} subscribers.`);
  }
  
  if (targetSubscriptions.length === 0) {
    console.log('No matching subscriptions found to send notification.');
    return res.status(200).json({ message: 'No matching subscriptions found to send.' });
  }

  const promises = targetSubscriptions.map(subscription => 
    webpush.sendNotification(subscription, notificationPayload)
      .catch(error => {
        // ถ้า endpoint หมดอายุหรือใช้งานไม่ได้ (HTTP 410 or 404) ควรลบออกจากฐานข้อมูล
        if (error.statusCode === 410 || error.statusCode === 404) {
          console.log('Subscription has expired or is no longer valid. Removing it.');
          subscriptions = subscriptions.filter(s => s.subscription.endpoint !== error.endpoint);
        } else {
           console.error('Error sending notification to ', subscription.endpoint, error);
        }
      })
  );

  Promise.all(promises)
    .then(() => res.status(200).json({ message: 'Notifications sent successfully.' }))
    .catch(err => {
      console.error("Error sending notifications: ", err);
      res.sendStatus(500);
    });
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
