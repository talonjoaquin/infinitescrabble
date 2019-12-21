var app = require('express')();
var http = require('http').createServer(app);
var io = require('socket.io')(http);

const uuidv4 = require('uuid/v4');
const PORT = process.env.PORT || 3000;

var users = [];

app.get('/', function(req, res) {
    res.sendFile(__dirname + '/index.html');
});

io.on('connection', function(socket){
    var id = uuidv4();
    console.log('new user connected; assigned as ' + id);

    var user = {
        id: id,
        name: '',
        score: 0
    };

    users.push(user);

    socket.on('disconnect', function(){
        for(var i = 0; i < users.length; i++){
            if(users[i].id == id){
                users.splice(i, 1);
            }
        }

        console.log('user ' + id + ' disconnected');
    })
});

http.listen(PORT, function() {
    console.log('listening on *:' + PORT);
})