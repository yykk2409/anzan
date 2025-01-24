const express = require('express');
const socketIo = require('socket.io');
const http = require('http');

const app = express();
const server = http.createServer(app);

const rooms = {};  // ルームの管理
let currentAnswer = 0

// Socket.IOをサーバーに接続
const io = socketIo(server, {
    transports: ['polling', 'websocket'], // pollingとwebsocket両方をサポート
});

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

io.on('connection', (socket) => {
    console.log('A user connected');
    
    
    // ルーム参加
    socket.on('joinRoom', (roomId) => {
        if (!rooms[roomId]) {
            rooms[roomId] = [];
        }
        
        rooms[roomId].push(socket);
        socket.join(roomId);
        
        if (rooms[roomId].length === 1) {
            io.to(roomId).emit('startGame', '対戦相手が見つかるまでしばらくお待ちください...');
        }else if (rooms[roomId].length === 2) {
            io.to(roomId).emit('startGame', 'ゲーム開始');
            const num1 = Math.floor(Math.random() * 90) + 10;  // 10〜99
            const num2 = Math.floor(Math.random() * 90) + 10;  // 10〜99
            currentAnswer = num1 * num2;
            io.to(roomId).emit('question', {
                question: `${num1} × ${num2} = ?`,
                answerLength: currentAnswer.toString().length
            });
        }
    });

    // ゲームの進行
    socket.on('submitAnswer', (data) => {
        const { roomId, userAnswer } = data;
        const otherPlayer = rooms[roomId].find(s => s !== socket); // 他のプレイヤーを見つける
    
        if (currentAnswer.toString().length === userAnswer.toString().length) {
            if (userAnswer === currentAnswer) {
                socket.emit('gameResult', 'YOU WIN');
                otherPlayer.emit('gameResult', 'YOU LOSE');

                setTimeout(() => {
                    const num1 = Math.floor(Math.random() * 90) + 10;  // 10〜99
                    const num2 = Math.floor(Math.random() * 90) + 10;  // 10〜99
                    currentAnswer = num1 * num2;
                    io.to(roomId).emit('question', {
                        question: `${num1} × ${num2} = ?`,
                        answerLength: currentAnswer.toString().length
                    });
                }, 3000);
            } else {
                // 送ってきた人には「不正解」
                socket.emit('gameResult', '不正解');
                otherPlayer.emit('gameResult', '相手が不正解しました');
            }
        }
    });

    socket.on('disconnect', () => {
        console.log('A user disconnected');
        
        // すべてのルームをチェックして、ユーザーが所属しているルームを見つける
        for (const roomId in rooms) {
            if (rooms[roomId].includes(socket)) {
                // ユーザーがこのルームにいる場合
                const otherPlayer = rooms[roomId].find(s => s !== socket); // もう一人のプレイヤーを見つける
                
                // ユーザーをそのルームから削除
                rooms[roomId] = rooms[roomId].filter(s => s !== socket);
                
                // 残ったプレイヤーに「相手が切断しました」と通知
                if (otherPlayer) {
                    otherPlayer.emit('stopGame', '相手が切断しました<br>対戦相手が見つかるまでしばらくお待ちください...');
                }
    
                // ルーム内にプレイヤーがいなくなったら、そのルームを削除
                if (rooms[roomId].length === 0) {
                    delete rooms[roomId];
                }
                
                break; // ルームを見つけたらループを抜ける
            }
        }
    });    
});

server.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
});
