'use strict';

class Interface {
  constructor(users, channels, statistics) {
    this._users = users;
    this._channels = channels;
    this._statistics = statistics;
  }
  get users() {
    return this._users;
  }
  get channels() {
    return this._channels;
  }
  get statistics() {
    return this._statistics;
  }

  setupDefaultChannels() {
    let defaultChannel = this.channels.create('default');
    defaultChannel.autodestroy = false;

    let globalChannel = this.channels.create('global');
    globalChannel.leaveable = false;
    globalChannel.joinable = true;
    globalChannel.silent = true;
    globalChannel.autodestroy = false;
  }

  onMessage(user, message) {
    if (message.startsWith('/')) {
      let tokens = message.trim().replace(/\s+/, ' ').split(' ');
      let command = tokens[0];
      console.log(command);

      if (command === '/nickname' && tokens.length > 1) {
        let name = tokens[1];
        let found = this.users.getByName(name);

        if (found === undefined) {
          user.name = name;
          user.status(this.channels.getByName('global'), `Name changed to ${name}`);
        } else {
          user.error(this.channels.getByName('global'), `A user with the name ${name} is already online`);
        }
      } else if (command === '/join' && tokens.length > 1) {
        let name = tokens[1];
        let channel = this.channels.getByName(name);

        if (name.startsWith('~')) {
          user.status(this.channels.getByName('global'), 'You do not have the permission to create a private channel');
          return;
        }

        if (channel === undefined) {
          channel = this.channels.create(name);
          user.status(channel, 'You created the channel');
        }

        user.join(channel);
      } else if (command === '/leave') {
        if (tokens.length > 1) {
          let name = tokens[1];
          let channel = this.channels.getByName(name);

          if (channel === undefined) {
            user.status(this.channels.getByName('global'), `The channel ${name} does not exist`);
            return;
          }

          user.leave(channel);
        } else {
          user.leave(user.activeChannel);
        }
      } else if (command === '/switch' && tokens.length > 1) {
        let name = tokens[1];
        let channel = this.channels.getByName(name);

        if (channel === undefined) {
          user.status(this.channels.getByName('global'), `The channel ${name} does not exist`);
          return;
        }

        user.activeChannel = channel;
        user.status(channel, 'You are now speaking in this channel');
      } else if (command === '/block' && tokens.length > 1) {
        let name = tokens[1];
        let target = this.users.getByName(name);

        if (target === user) {
          user.status(user.activeChannel, 'You cannot block yourself');
        } else if (target !== undefined) {
          user.block(target);
        } else {
          user.status(user.activeChannel, `The user ${name} does not exist`);
        }
      } else if (command === '/unblock' && tokens.length > 1) {
        let name = tokens[1];
        let target = this.users.getByName(name);
        if (target === user) {
          user.status(user.activeChannel, 'You cannot unblock yourself');
        } else if (target !== undefined) {
          user.unblock(target);
        } else {
          user.status(user.activeChannel, `The user ${user.name} does not exist`);
        }
      } else if (command === '/wsp' && tokens.length > 1) {
        let name = tokens[1];
        let target = this.users.getByName(name);

        if (target === undefined) {
          user.status(user.activeChannel, `The user ${name} does not exist`);
          return;
        }

        let channelName = `~${user.name}->${target.name}`;

        let privateChannel = this.channels.create(channelName);
        privateChannel.joinable = false;
        privateChannel.leaveable = false;
        privateChannel.users = [user, target];
        user.channels.push(privateChannel);
        target.channels.push(privateChannel);

        user.activeChannel = privateChannel;
        user.status(privateChannel, `You are now whispering to ${target.name}`);
      } else {
        user.error(user.activeChannel, 'Unknown command: ' + command);
      }

      return;
    }

    let active = user.activeChannel;

    if (active !== undefined) {
      active.message(user, message);
    }
  }
  onJoin(user) {
    this.users.push(user);
    this.statistics.count++;

    let defaultChannel = this.channels.getByName('default');
    let globalChannel = this.channels.getByName('global');
    user.join(globalChannel);
    user.join(defaultChannel);
  }
  onLeave(user) {
    var index = this.users.indexOf(user);
    this.users.splice(index, 1);
    user.leaveAll();
  }
}

exports.Interface = Interface;
