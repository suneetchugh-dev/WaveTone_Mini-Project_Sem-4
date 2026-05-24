import re

# Read the file
with open('index.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Pattern to match the room-users emit in join-room
pattern1 = r"(    // Broadcast updated participant list to all other users in the room
    // \(socket\.to excludes the new joiner, they already got it above\)
)    socket\.to\(roomId\)\.emit\('room-users', participants\.map\(p => \(\{
      socketId: p\.socketId,
      alias: p\.alias,
      joinedAt: p\.joinedAt,
      leftAt: p\.leftAt
    \}\)\);"

replacement1 = r"\1    const hostInfo = roomHosts.get(roomId);\n    socket.to(roomId).emit('room-users', participants.map(p => ({\n      socketId: p.socketId,\n      alias: p.alias,\n      joinedAt: p.joinedAt,\n      leftAt: p.leftAt,\n      isHost: hostInfo && hostInfo.socketId === p.socketId\n    })));"

content = re.sub(pattern1, replacement1, content)

# Pattern to match the room-users emit in _leaveRoom
pattern2 = r"(      // Broadcast updated participant list for Browse page real-time updates
)      io\.to\(roomId\)\.emit\('room-users', participants\.map\(p => \(\{
        socketId: p\.socketId,
        alias: p\.alias,
        joinedAt: p\.joinedAt,
        leftAt: p\.leftAt
      \}\)\);"

replacement2 = r"\1      const hostInfo = roomHosts.get(roomId);\n      io.to(roomId).emit('room-users', participants.map(p => ({\n        socketId: p.socketId,\n        alias: p.alias,\n        joinedAt: p.joinedAt,\n        leftAt: p.leftAt,\n        isHost: hostInfo && hostInfo.socketId === p.socketId\n      })));"

content = re.sub(pattern2, replacement2, content)

# Write the file back
with open('index.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("File updated successfully")
