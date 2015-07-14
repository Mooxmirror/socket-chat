var socket = undefined;

// Initialize connections etc.
function init() {
  socket.on('message', function(obj) {
    var entry = $('<div>', {
      class: 'chat-entry'
    });
    entry.addClass('message');

    var channel = $('<span>', {
      class: 'chat-message-channel'
    });
    var source = $('<span>', {
      class: 'chat-message-source'
    });
    var content = $('<span>', {
      class: 'chat-message-content'
    });

    channel.text('[' + obj.channel + ']');
    source.text(obj.source);
    content.text(obj.content);

    entry.append(channel);
    entry.append(source);
    entry.append(content);

    $('#chat-display').append(entry);
    $('#chat-display').scrollTop(Infinity);
  });

  socket.on('err', function(obj) {
    var entry = $('<div>', {
      class: 'chat-entry error-message'
    });

    var channel = $('<span>', {
      class: 'chat-message-channel chat-message-wide'
    });
    var content = $('<span>', {
      class: 'chat-message-content'
    });

    channel.text('')
    content.text(obj.content);

    channel.text('[' + obj.channel + ']');
    entry.append(channel);
    entry.append(content);

    $('#chat-display').append(entry);
    $('#chat-display').scrollTop(Infinity);
  });

  socket.on('status', function(obj) {
    var entry = $('<div>', {
      class: 'chat-entry status-message'
    });

    var channel = $('<span>', {
      class: 'chat-message-channel chat-message-wide'
    });
    var content = $('<span>', {
      class: 'chat-message-content'
    });

    channel.text('')
    content.text(obj.content);

    channel.text('[' + obj.channel + ']');
    entry.append(channel);
    entry.append(content);

    $('#chat-display').append(entry);
    $('#chat-display').scrollTop(Infinity);
  });
}

$(function() {
  $('#chat-panel').hide();
  $('#send-form').submit(function() {
    var text = $('#send-form-message').val();
    socket.emit('message', text);
    $('#send-form-message').val('');
    return false;
  });
  $('#login-form-action').click(function() {
    var username = $('#login-form-name').val();

    socket = io();
    socket.emit('message', '/nickname ' + username);

    init();
    $('#login-panel').hide(250);
    $('#chat-panel').show(250);
    return false;
  });

});
