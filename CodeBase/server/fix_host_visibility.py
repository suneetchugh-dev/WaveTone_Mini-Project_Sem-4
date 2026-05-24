import re

# Read the file
with open('index.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Find and replace the first occurrence (around line 228)
old_text1 = """    socket.to(roomId).emit('room-users', participants.map(p => ({
      socketId: p.socketId,
      alias: p.alias,
      joinedAt: p.joinedAt,
      leftAt: p.leftAt
    })));"""

new_text1 = """    const hostInfo = roomHosts.get(roomId);
    socket.to(roomId).emit('room-users', participants.map(p => ({
      socketId: p.socketId,
      alias: p.alias,
      joinedAt: p.joinedAt,
      leftAt: p.leftAt,
      isHost: hostInfo && hostInfo.socketId === p.socketId
    })));"""

content = content.replace(old_text1, new_text1, 1)

# Find and replace the second occurrence (around line 690)
old_text2 = """      io.to(roomId).emit('room-users', participants.map(p => ({
        socketId: p.socketId,
        alias: p.alias,
        joinedAt: p.joinedAt,
        leftAt: p.leftAt
      })));"""

new_text2 = """      const hostInfo = roomHosts.get(roomId);
      io.to(roomId).emit('room-users', participants.map(p => ({
        socketId: p.socketId,
        alias: p.alias,
        joinedAt: p.joinedAt,
        leftAt: p.leftAt,
        isHost: hostInfo && hostInfo.socketId === p.socketId
      })));"""

content = content.replace(old_text2, new_text2, 1)

# Write the file back
with open('index.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("File updated successfully")
