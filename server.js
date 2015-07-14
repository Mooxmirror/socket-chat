'use strict';

var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var Interface = require('./interface.js').Interface;

var userInterface;

// Listen for file serving
app.get('/', function(req, res) {
  res.sendFile(__dirname + '/index.html');
});

app.get('/assets/script.js', function(req, res) {
  res.sendFile(__dirname + '/assets/script.js');
});

app.get('/assets/style.css', function(req, res) {
  res.sendFile(__dirname + '/assets/style.css');
});

class Channel {
  constructor(name, host) {
    this._host = host;
    this._name = name;
    this._id = '';
    this._users = [];
    this._joinable = true;
    this._leavable = true;
    this._silent = false;
    this._autodestroy = true;
  }

  get id() {
    return this._id;
  }

  set id(id) {
    this._id = id;
  }

  get autodestroy() {
    return this._autodestroy;
  }

  set autodestroy(autodestroy) {
    this._autodestroy = autodestroy;
  }

  set silent(silent) {
    this._silent = silent;
  }

  get silent() {
    return this._silent;
  }

  get name() {
    return this._name;
  }

  message(source, text) {
    if (this.silent) {
      source.error(this, 'You do not have the permission to write messages');
      return;
    }

    for (let user of this.users) {
      if (!user.isBlocked(source)) {
        user.message(this, source, text);
      }
    }
  }

  status(text) {
    for (let user of this.users) {
      user.status(this, text);
    }
  }

  error(text) {
    for (let user of this.users) {
      user.error(this, text);
    }
  }

  get leaveable() {
    return this._leavable;
  }

  set leaveable(leaveable) {
    this._leavable = leaveable;
  }

  get joinable() {
    return this._joinable;
  }

  set joinable(joinable) {
    this._joinable = joinable;
  }

  get host() {
    return this._host;
  }

  leave(user) {
    return leave(user, false);
  }
  leave(user, force) {
    if (!this.leaveable && !force) {
      user.error(this, 'You do not have the permission to leave');
      return false;
    }

    let index = this.users.indexOf(user);
    if (index === -1) {
      user.error(this, 'You already left the channel');
      return false;
    }

    this.users.splice(index, 1);
    user.status(this, 'You left the channel');
    if (!this.silent) {
      this.status(`${user.name} left the channel`);
    }

    if (this.autodestroy) {
      this.host.delete(this.id);
    }

    return true;
  }

  join(user) {
    if (!this.joinable) {
      user.error(this, 'You do not have the permission to join');
      return false;
    }

    let index = this.users.indexOf(user);
    if (index > -1) {
      user.error(this, 'You already joined the channel');
      return false;
    }

    user.status(this, 'You joined the channel');
    if (!this.silent) {
      this.status(`${user.name} joined the channel`);
    }

    this.users.push(user);
    return true;
  }

  kick(user) {
    let index = this.users.indexOf(user);
    if (index === -1) {
      return;
    }

    this.users.splice(index, 1);
    user.status(this, 'You got kicked');
    if (!this.silent) {
      this.status(this, `${user.name} got kicked`);
    }
  }

  kickAll() {
    for (let user in this.users) {
      user.status(this, 'You got kicked');
    }
    this.users = [];
  }

  get users() {
    return this._users;
  }

  set users(users) {
    this._users = users;
  }
}

class User {
  constructor(socket) {
    this._name = `user-${userInterface.statistics.count}`;
    this._socket = socket;
    this._channels = [];
    this._active = undefined;
    this._blocked = [];
  }
  get socket() {
    return this._socket;
  }
  get activeChannel() {
    return this._active;
  }
  set activeChannel(channel) {
    let index = this.channels.indexOf(channel);
    if (index === -1) {
      this.join(channel);
      return;
    }
    this._active = channel;
  }
  get blocked() {
    return this._blocked;
  }
  block(user) {
    let index = this.blocked.indexOf(user);
    if (index === -1) {
      this.blocked.push(user);
      this.status(this.activeChannel, `You blocked ${user.name}`);
    } else {
      this.error(this.activeChannel, `${user.name} is already blocked`);
    }
  }
  unblock(user) {
    let index = this.blocked.indexOf(user);
    if (index > -1) {
      this.blocked.splice(index, 1);
      this.status(this.activeChannel, `You unblocked ${user.name}`);
    } else {
      this.error(this.activeChannel, `You can not unblock ${user.name}`);
    }
  }
  isBlocked(user) {
    let index = this.blocked.indexOf(user);
    if (index > -1) return true;
    return false;
  }
  get name() {
    return this._name;
  }
  set name(name) {
    this._name = name;
  }
  message(channel, source, content) {
    this._socket.emit('message', {
      channel: channel.name,
      source: source.name,
      content
    });
  }
  status(channel, content) {
    this._socket.emit('status', {
      channel: channel.name,
      content
    });
  }
  error(channel, content) {
    this._socket.emit('err', {
      channel: channel.name,
      content
    });
  }
  get channels() {
    return this._channels;
  }
  set channels(channels) {
    this._channels = channels;
  }
  join(channel) {
    if (channel.join(this)) {
      this.channels.push(channel);
      this.activeChannel = channel;
    }
  }
  leave(channel) {
    if (channel.leave(this)) {
      let index = this.channels.indexOf(channel);
      this.channels.splice(index, 1);

      if (this.channels.length > 0) {
        this.activeChannel = this.channels[0];
      }
    }
  }
  leaveAll(channel) {
    for (let channel of this.channels) {
      channel.leave(this, true);
    }
    this.channels = [];
  }
};

function setupInterface() {
  // Setup channels
  let channels = new Map();
  channels.count = 0;
  channels.getByName = function(name) {
    for (let id of this.keys()) {
      let channel = this.get(id);
      if (channel.name === name) return channel;
    }
    return undefined;
  };
  channels.getById = function(id) {
    return this.get(id);
  };
  channels.create = function(name) {
    let channel = new Channel(name, this);
    channel.id = `ch-${this.count}.${(new Date())-0}`
    this.set(channel.id, channel);
    return channel;
  };
  channels.remove = function(id) {
    let chan = this.get(id);
    if (chan === undefined) return;
    chan.kickAll();
    this.delete(id);
  };
  // Setup statistics
  let statistics = {
    count: 0
  };

  // Setup users
  let users = [];
  users.getByName = function(name) {
    for (let user of users) {
      if (user.name === name) return user;
    }
    return undefined;
  }

  userInterface = new Interface(users, channels, statistics);
  userInterface.setupDefaultChannels();
  console.log('created interface');
}
setupInterface();
// Do connection handling here
io.on('connection', function(socket) {
  console.log('new user');
  var user = new User(socket);
  userInterface.onJoin(user);

  socket.on('message', function(text) {
    userInterface.onMessage(user, text);
  });

  socket.on('disconnect', function() {
    userInterface.onLeave(user);
  });
});


http.listen(3000, function() {
  console.log('server up and running on *:3000');
});
