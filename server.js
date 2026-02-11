const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Ensure the upload folder exists
const uploadDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// Multer Storage Configuration
const storage = multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage });

app.use(express.static('public'));
app.use('/uploads', express.static(uploadDir));

// In-memory data storage (Will reset on server restart)
let sharedCode = "// Start coding here...";
let messages = [];

// FILE UPLOAD ROUTE
app.post('/upload', upload.single('myFile'), (req, res) => {
    if (req.file) {
        const fileUrl = `/uploads/${req.file.filename}`;
        const fileName = req.file.originalname;
        const msg = `📁 <a href="${fileUrl}" download class="file-link">Download: ${fileName}</a>`;
        
        messages.push(msg);
        io.emit('new-msg', msg); // Sends to EVERYONE
        res.status(200).send("Success");
    }
});

// REAL-TIME LOGIC
io.on('connection', (socket) => {
    // Send history to the person who just joined
    socket.emit('init', { code: sharedCode, messages: messages });

    // When someone types code
    socket.on('code-change', (newCode) => {
        sharedCode = newCode;
        socket.broadcast.emit('code-update', newCode);
    });

    // When someone sends a chat message
    socket.on('send-msg', (text) => {
        const msg = `<strong>User:</strong> ${text}`;
        messages.push(msg);
        io.emit('new-msg', msg); // This shows to ALL users
    });

    // Admin Wipe Logic
    socket.on('admin-delete', (pw) => {
        if (pw === "vijay@123") {
            sharedCode = "";
            messages = [];
            io.emit('init', { code: "", messages: [] });
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server live on port ${PORT}`));