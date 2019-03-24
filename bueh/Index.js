'use strict'
// includes the File System module
const fs = require('fs')
const express = require('express')
const app = express()
const socketIO = require('socket.io')
const path = require('path')
const PORT = process.env.PORT || 3000

const server = app.listen(PORT, () => console.log(`Listening on ${ PORT }`))
const questions = JSON.parse(fs.readFileSync('questions.json', 'utf8'))
const gameTime = 25
const io = socketIO(server)	

let games = []


// Start of Routing


app.get('/player', function (req, res) {
  if (req.query.gameID && gameExists(req.query.gameID)) {
    res.sendFile(__dirname + '/Begofproj.html')
  }
  else {
    res.redirect('/home')
  }
})

app.get('/dist', function (req, res) {
  if (req.query.gameID && gameExists(req.query.gameID)) {
    res.sendFile(__dirname + '/Project.html')
  }
  else {
    res.redirect('/home')
  }
})

app.get('/home', function (req, res) {
  res.sendFile(__dirname + '/home.html')
})

app.use('/public', express.static(__dirname + '/public'))
// End of routing



io.on('connection', (socket) => {
  console.log('Client connected')
  socket.on('disconnect', function () {
    console.log('Client disconnected')
  })
})


var liveg = io.of('/game')

liveg.on('connection', function (socket) {
  console.log('server on connection')

  socket.on('startGame', function (role) {
    checkForGame(role)
  })

  socket.on('joined', function (gameID) {
    socket.join(gameID)

    if (checkIfGameFull(gameID)) {
      let questionText = ''

      for (let i = 0; i < games.length; i++) {
        if (games[i].uniqueID == gameID) {
          let random = Math.floor(Math.random() * Object.keys(questions).length)

          games[i].text = random
          questionText = questions[random].text
          break
        }
      }

      liveg.to(gameID).emit('full', questionText)

      if (!checkIfGameStarted(gameID)) {
        setTimer(gameID, gameTime)

        for (let i = 0; i < games.length; i++) {
          if (games[i].uniqueID == gameID) {
            games[i].hasStarted = true
            break
          }
        }
      }
    }
  })
  
  socket.on('textEvent', function (textEvent) {
    liveg.to(textEvent.gameID).emit('textEvent', textEvent.name)
  })

  socket.on('answer', function (answer) {
    let question
    let text
    for (let i = 0; i < games.length; i++) {
      if (games[i].uniqueID == answer.gameID) {
        question = games[i].question
        text = games[i].text
        games.splice(i, 1)
        break
      }
    }

    if (questions[text].props[question].correctAnswer == answer.answer) {
      liveg.to(answer.gameID).emit('correct', true)
    }
    else {
      liveg.to(answer.gameID).emit('correct', false)
    }
  })
})

function checkForGame(role) {
  let openGame = false
  let game = false

  for (let i = 0; i < games.length; i++) {
    if (role == 'player' && games[i].hasPlayer) {
      continue
    }
    else if (role == 'controller' && games[i].hasController) {
      continue
    }

    if (games[i].playerCount != 2) {
      openGame = true
      game = games[i]
      break
    }
  }

  if (openGame) {
    game.playerCount++
    liveg.emit('game', game.uniqueID)
  }
  else {
    let uniqueID = generateUniqueID()
    game = {
      'uniqueID': uniqueID,
      'playerCount': 1,
      'hasPlayer': false,
      'hasController': false,
      'hasStarted': false,
      'question': null,
      'text': null
    }
    games.push(game)

    liveg.emit('game', uniqueID)
  }

  if (role == 'player') {
    game.hasPlayer = true
  }
  else if (role == 'controller') {
    game.hasController = true
  }
}

function generateUniqueID() {
  var text = ""
  var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"

  for (let i = 0; i < 5; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length))
  }

  return text
}

function gameExists(gameID) {
  let gameExists = false

  for (let i = 0; i < games.length; i++) {
    if (games[i].uniqueID == gameID) {
      gameExists = true
    }
  }

  return gameExists
}

function checkIfGameFull(gameID) {
  let gameFull = false

  for (let i = 0; i < games.length; i++) {
    if (games[i].uniqueID == gameID && (games[i].hasController && games[i].hasPlayer)) {
      gameFull = true
      break
    }
  }

  return gameFull
}

function checkIfGameStarted(gameID) {
  let gameStarted = false

  for (let i = 0; i < games.length; i++) {
    if (games[i].uniqueID == gameID && games[i].hasStarted) {
      gameStarted = true
      break
    }
  }

  return gameStarted
}

function setTimer(gameID, seconds) {
  let i = 0
  let interval = setInterval(function () {
      if (seconds - i == 0) {
        liveg.to(gameID).emit('timer', 0)

        let gameQuestion
        for (let i = 0; i < games.length; i++) {
          if (games[i].uniqueID == gameID) {
            let random = Math.floor(Math.random() * Object.keys(questions[games[i].text].props).length)
            gameQuestion = questions[games[i].text].props[random]
            games[i].question = random
            break
          }
        }

        liveg.to(gameID).emit('question', gameQuestion)

        clearInterval(interval)
      }
      else {
          liveg.to(gameID).emit('timer', seconds - i)
      }

      i++
  }, 1000)
}