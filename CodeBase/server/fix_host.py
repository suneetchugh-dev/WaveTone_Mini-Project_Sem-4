# Read the file
with open('index.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find and modify the first occurrence (around line 228)
for i in range(len(lines)):
    if i > 0 and 'socket.to(roomId).emit' in lines[i] and 'room-users' in lines[i]:
        # Insert hostInfo before this line
        lines.insert(i, '    const hostInfo = roomHosts.get(roomId);\n')
        # Find the leftAt line and add isHost after it
        for j in range(i, len(lines)):
            if 'leftAt: p.leftAt' in lines[j]:
                lines[j] = lines[j].rstrip() + ',\n'
                lines.insert(j+1, '      isHost: hostInfo && hostInfo.socketId === p.socketId\n')
                break
        break

# Find and modify the second occurrence (around line 690)
for i in range(len(lines)):
    if i > 0 and 'io.to(roomId).emit' in lines[i] and 'room-users' in lines[i]:
        # Insert hostInfo before this line
        lines.insert(i, '      const hostInfo = roomHosts.get(roomId);\n')
        # Find the leftAt line and add isHost after it
        for j in range(i, len(lines)):
            if 'leftAt: p.leftAt' in lines[j]:
                lines[j] = lines[j].rstrip() + ',\n'
                lines.insert(j+1, '        isHost: hostInfo && hostInfo.socketId === p.socketId\n')
                break
        break

# Write the file back
with open('index.js', 'w', encoding='utf-8') as f:
    f.writelines(lines)

print("File updated successfully")
