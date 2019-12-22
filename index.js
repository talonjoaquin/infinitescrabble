var app = require('express')();
var http = require('http').createServer(app);
var io = require('socket.io')(http);
var apikeys = require('./apikeys.json');

const uuidv4 = require('uuid/v4');
const PORT = process.env.PORT || 3000;
const https = require('https');

var prob_lookup = {
    '_': 2,
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
    '_': 0,
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
var old_board = []; //allows rollback
var newlyadded = []; //newly added tiles\

var new_letters = [];

var notification = '';

function addToBoard(tiles){
    new_letters = JSON.parse(JSON.stringify(users[current_turn].letters));

    var tempLetters = JSON.parse(JSON.stringify(users[current_turn].letters));
    for(var i = 0; i < tiles.length; i++){
        var letter = tiles[i].letter;
        var index = tempLetters.indexOf(letter);

        if(index >= 0){
            tempLetters.splice(index, 1);
        }else{
            //check if free tile exists
            var free = tempLetters.indexOf('_');
            if(free >= 0) {
                tempLetters.splice(free, 1);
            }else{
                notification = 'you don\'t have the right letters for that!';
                return false;
            }
        }
    }

    

    for(var i = 0; i < tiles.length; i++){
        for(var j = 0; j < board.length; j++){
            if(tiles[i].x == board[j].x && tiles[i].y == board[j].y){
                //overlap between board and tiles to be added
                notification = 'bad input!';
                return false;
            }
        }
    }



    newlyadded = [];
    //clone board pre add
    old_board = JSON.parse(JSON.stringify(board));
    for(var i = 0; i < tiles.length; i++){
        setBoard(tiles[i].x, tiles[i].y, tiles[i].letter);
    }

    new_letters = JSON.parse(JSON.stringify(tempLetters));

    return true;
}

function setBoard(x, y, char){
    var tile = {
        x: x,
        y: y,
        letter: char
    }
    
    console.log('setting ' + char + ' at (' + x + ', ' + y + ')');


    for(var i = 0; i < board.length; i++){
        if(tile.n && tile.e && tile.w && tile.s)
            break;
        if(board[i].x == x - 1 && board[i].y == y){
            tile.w = i;
            board[i].e = board.length;
        }else if(board[i].x == x + 1 && board[i].y == y){
            tile.e = i;
            board[i].w = board.length;
        }else if(board[i].x == x && board[i].y == y - 1){
            tile.n = i;
            board[i].s = board.length;
        }else if(board[i].x == x && board[i].y == y + 1){
            tile.s = i;
            board[i].n = board.length;
        }
    }
    board.push(tile);
    newlyadded.push(tile);

    console.log('board is now: ' + JSON.stringify(board));
    console.log('newlyadded is: ' + JSON.stringify(newlyadded));
}


async function apiLoop(words){
    var valid_words = [];
    var invalid = false;
    for(var i = 0; i < words.length; i++){
        console.log('hitting api for ' + words[i]);

        let res = await hitApi(words[i]);
        
        console.log('res is ' + res);
        
        if(res){
            valid_words.push(res);
            console.log(res + ' is valid');
        }else{
            invalid = true;
        }
    }
    return [valid_words, invalid];
}

function hitApi(word){
    return new Promise((resolve, reject) => {
        //hit dictionary apis here
        const url = 'https://www.dictionaryapi.com/api/v3/references/collegiate/json/'+word+'?key=' + apikeys.dict_key;
        https.get(url, (resp) => {
            
            let data = '';

            // A chunk of data has been recieved.
            resp.on('data', (chunk) => {
                data += chunk;
            });

            // The whole response has been received. Print out the result.
            resp.on('end', () => {
                //console.log(JSON.parse(data));
                data = JSON.parse(data);
                //console.log(JSON.parse(data[0]));
                //console.log(JSON.parse(data[0].meta));

                if(!data[0].meta){
                    resolve(false);
                }else{
                    resolve(word);
                }
            });

        }).on("error", (err) => {
            console.log("Error: " + err.message);
            resolve(false);
        });
    });   
}

async function checkWords(){
    var invalid = false;
    
    var words = [];
    var to_right = JSON.parse(JSON.stringify(newlyadded));
    var to_down = JSON.parse(JSON.stringify(newlyadded));

    //console.log('to_down: ' + JSON.stringify(to_down));

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
                            //console.log('LR: removing ' + JSON.stringify(to_right[j]));
                            to_right.splice(j, 1);
                            i = -1;
                        }
                    }
                    //console.log('LR: found ' + iter_tile.letter);
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

    //console.log('to_down: ' + JSON.stringify(to_down));

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
                            //console.log('UD: removing ' + JSON.stringify(to_down[j]));
                            //console.log('to_down: ' + JSON.stringify(to_down));
                            
                            to_down.splice(j, 1);
                            i = -1;
                        }
                    }
                    //console.log('UD: found ' + iter_tile.letter);
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
    //newlyadded = [];
    
    var valid_words = [];
    var score = 0;

    console.log('checking words: ' + JSON.stringify(words));

    var [vws, inv] = await apiLoop(words);
    
    valid_words = JSON.parse(JSON.stringify(vws));
    invalid = inv;
    
    if(invalid){
        return 0;
    }

    for(var i = 0; i < newlyadded.length;  i++){
        if(score_lookup[newlyadded[i].letter])
            score += score_lookup[newlyadded[i].letter];
    }
    console.log('returning score: ' + score);
    return score;    
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
    console.log('new user connected from socket ' + socket.id + '; assigned as ' + id);

    var user = {
        id: id,
        socketId: socket.id,
        name: '',
        score: 0,
        letters: getLetters()
    };

    users.push(user);

    console.log('users: ' + JSON.stringify(users));

    if(users.length == 1){
        current_turn = 0;
        io.to(users[0].socketId).emit('start of turn');
    }

    io.to(socket.id).emit('id', id);
    
    io.emit('state change', {'users':users, 'tiles': board, 'current_turn': users[current_turn].id});

    socket.on('submit', async function(tiles){

        console.log('submit received, tiles are: ' + JSON.stringify(tiles));

        if(id == users[current_turn].id){
            if(addToBoard(tiles)){
                var scored = await checkWords();
                console.log('added score: ' + scored);
                if(scored == 0){
                    console.log('NOT A WORD DANGIT');
                    board = JSON.parse(JSON.stringify(old_board));
                    io.to(users[current_turn].socketId).emit('bad input', {'message': 'Not a word! >:('});
                    io.to(users[current_turn].socketId).emit('state change', {'users': users, 'tiles': board, 'current_turn': users[current_turn].id});
                }else{
                    old_board = JSON.parse(JSON.stringify(board));
                    users[current_turn].letters = JSON.parse(JSON.stringify(new_letters));
                    users[current_turn].score += scored;
                    io.emit('state change', {'users': users, 'tiles': board, 'current_turn': users[current_turn].id});
                }
            }else{
                board = JSON.parse(JSON.stringify(old_board));
                io.to(users[current_turn].socketId).emit('bad input', {'message': notification});
                notification = '';
                io.to(users[current_turn].socketId).emit('state change', {'users': users, 'tiles': board, 'current_turn': users[current_turn].id});
            }
            io.to(users[current_turn].socketId).emit('processed');
        }
    });

    socket.on('next turn', function(){
        console.log('received next turn message from ' + socket.id);
        if(users.length > 0){
            //validate that it is your turn to end!
            if(users[current_turn].id == id){

                current_turn = (current_turn + 1) % users.length;

                console.log('current turn is: ' + current_turn);
                console.log('current user is: ' + JSON.stringify(users[current_turn]));

                io.emit('message', {'message': 'Your turn, ' + users[current_turn].id + '!'});
                
                users[current_turn].letters = getLetters();
                
                io.emit('state change', {'users':users, 'tiles': board, 'current_turn': users[current_turn].id});
                io.to(users[current_turn].socketId).emit('start of turn');
            }else{
                console.log('user ' + id + ' attempted to end turn not belonging to them!');
                io.to(user.socketId).emit('bad input', {'message': 'Not your turn to end!'});
            }
        }
    })


    socket.on('disconnect', function(){
        for(var i = 0; i < users.length; i++){
            if(users[i].id == id){
                users.splice(i, 1);
            }
        }
        if(users.length > 0)
            io.emit('state change', {'users':users, 'tiles': board, 'current_turn': users[current_turn].id});
        console.log('user ' + id + ' disconnected');
    })
});

http.listen(PORT, function() {
    console.log('listening on *:' + PORT);
})