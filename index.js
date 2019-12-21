var app = require('express')();
var http = require('http').createServer(app);
var io = require('socket.io')(http);
var apikeys = require('./apikeys.json');

const uuidv4 = require('uuid/v4');
const PORT = process.env.PORT || 3000;
const INITSIZE = 15;

var prob_lookup = {
    ' ': 2,
    'a': 9,
    'b': 2,
    'c': 2,
    'd': 4,
    'e': 12,
    'f': 2,
    'g': 3,
    'h': 2,
    'i': 9,
    'j': 1,
    'k': 1,
    'l': 4,
    'm': 2,
    'n': 6,
    'o': 8,
    'p': 2,
    'q': 1,
    'r': 6,
    's': 4,
    't': 6,
    'u': 4,
    'v': 2,
    'w': 2,
    'x': 1,
    'y': 2,
    'z': 1
}

var score_lookup = {
    ' ': 0,
    'a': 1,
    'b': 3,
    'c': 3,
    'd': 2,
    'e': 1,
    'f': 4,
    'g': 2,
    'h': 4,
    'i': 1,
    'j': 8,
    'k': 5,
    'l': 1,
    'm': 3,
    'n': 1,
    'o': 1,
    'p': 3,
    'q': 10,
    'r': 1,
    's': 1,
    't': 1,
    'u': 1,
    'v': 4,
    'w': 4,
    'x': 8,
    'y': 4,
    'z': 10
}

var users = []; //stores user objects
var current_turn = 0;
var board = []; //stores tile objects
var newlyadded = []; //newly added tiles

function setBoard(x, y, char){
    var tile = {
        x: x,
        y: y,
        letter: char
    }
    for(var i = 0; i < board.length; i++){
        if(tile.n && tile.e && tile.w && tile.s)
            break;
        if(board[i].x == x - 1 && board[i].y == y)
            tile.w = i;
        else if(board[i].x == x + 1 && board[i].y == y)
            tile.e = i;
        else if(board[i].x == x && board[i].y == y - 1)
            tile.n = i;
        else if(board[i].x == x && board[i].y == y - 1)
            tile.s = i;
    }
    board.push(tile);
    newlyadded.push(tile);
}

function checkWords(){
    var invalid = false;
    
    var words = [];
    var to_right = JSON.parse(JSON.stringify(newlyadded));
    var to_down = JSON.parse(JSON.stringify(newlyadded));
    for(var i = 0; i < to_right.length; i++){
        //check left and top of tile for words
        var word = '';
        var leftmost = false;
        var curr_tile = to_right[i];
        while(!leftmost){
            if(curr_tile.w){
                curr_tile = board[curr_tile.w];
            }else{
                leftmost = true;
                var rightmost = false;
                var iter_tile = curr_tile;
                while(!rightmost){
                    for(var j = 0; j < to_right.length; j++){
                        if(to_right[j].x == iter_tile.x && to_right[j].y == iter_tile.y){
                            to_right.splice(j, 1);
                        }
                    }
                    word += iter_tile.letter;
                    if(iter_tile.e){
                        iter_tile = board[iter_tile.e];
                    }else{
                        rightmost = true;
                    }
                }
            }
        }

        //check that there exists a word of min length 2
        if(word.length >= 2){
            words.push(word);
        }
    }
    for(var i = 0; i < to_down.length; i++){
        var word = '';
        var topmost = false;
        var curr_tile = to_down[i];
        while(!topmost){
            if(curr_tile.n){
                curr_tile = board[curr_tile.n];
            }else{
                topmost = true;
                var downmost = false;
                var iter_tile = curr_tile;
                while(!downmost){
                    for(var j = 0; j < to_down.length; j++){
                        if(to_down[j].x == iter_tile.x && to_down[j].y == iter_tile.y){
                            to_down.splice(j, 1);
                        }
                    }
                    word += iter_tile.letter;
                    if(iter_tile.s){
                        iter_tile = board[iter_tile.s];
                    }else{
                        downmost = true;
                    }
                }
            }
        }
        
        //check that there exists a word of min length 2
        if(word.length >= 2){
            words.push(word);
        }
    }
    newlyadded = [];
    
    var valid_words = [];
    var score = 0;

    for(var i = 0; i < words.length; i++){
        //hit dictionary apis here
        const url = 'https://www.dictionaryapi.com/api/v3/references/collegiate/json/'+words[i]+'?key=' + apikeys.dict_key;
        fetch(url)
        .then(data=>{
            return data.json()
        })
        .then(res=>{
            if(!res[0].meta){
                invalid = true;
            }else{
                valid_words.push(words[i]);
            }
        })
    }

    for(var i = 0; i < valid_words.length; i++){
        for(var j = 0; j < valid_words[i].length; j++){
            if(score_lookup[valid_words[i].charAt(j)])
                score += score_lookup[valid_words[i].charAt(j)];
        }
    }

    if(invalid){
        return 0;
    }else{
        return score;
    }
}

function getLetters(){
    var letters = [];
    while(letters.length < 7){
        var letter = '';

        var rand = Math.random() * 100;
        var keys = Object.keys(prob_lookup);
        var cum_sum = 0;

        for(var i = 0; i < keys.length; i++){
            cum_sum += prob_lookup[keys[i]];

            if(rand < cum_sum){
                letter = keys[i];
                break;
            }
        }

        letters.push(letter);
    }
    return letters;
}
app.get('/', function(req, res) {
    res.sendFile(__dirname + '/index.html');
});

io.on('connection', function(socket){
    var id = uuidv4();
    console.log('new user connected from socket ' + socketId + '; assigned as ' + id);

    var user = {
        id: id,
        socketId: socketId,
        name: '',
        score: 0
    };

    users.push(user);


    socket.on('submit', function(tiles){
        if(id == users[current_turn].id){
            for(var i = 0; i < tiles.length; i++){
                setBoard(tiles[i].x, tiles[i].y, tiles[i].letter);
            }
            var scored = checkWords();
            if(scored == 0){
                io.to(users[current_turn].socketId).emit('badinput', {'message': 'Not a word! >:('});
            }else{
                users[current_turn].score += scored;
            }
        }
    });

    socket.on('next turn', function(){
        if(users.length > 0){
            //validate that it is your turn to end!
            if(users[current_turn].id == id){
                current_turn = (current_turn + 1) % user.length;
                io.emit('message', {'message': 'Your turn, ' + users[current_turn].name + '!'});
                io.to(users[current_turn].socketId).emit('start of turn', {'letters': getLetters()});
            }else{
                console.log('user ' + id + ' attempted to end turn not belonging to them!');
                io.to(user.socketId).emit('bad_input', {'message': 'Not your turn to end!'});
            }
        }
    })


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