
import os

MAX_BYTES = 5000 # Sprites are small

def fix_png(path):
    with open(path, 'rb') as f:
        data = f.read()
    
    # IEND chunk hex: 49 45 4E 44
    # CRC hex: AE 42 60 82
    iend_idx = data.find(b'IEND')
    if iend_idx != -1:
        # IEND is 4 bytes + 4 bytes CRC = 8 bytes total
        cutoff = iend_idx + 8
        if len(data) > cutoff:
            print(f'Stripping {len(data) - cutoff} trailing bytes from {os.path.basename(path)}')
            with open(path, 'wb') as f:
                f.write(data[:cutoff])
        else:
            print(f'OK: {os.path.basename(path)}')
    else:
        print(f'WARNING: No IEND found in {os.path.basename(path)}')

base_dir = r"d:\Workspaces\OLLM CLI\docs\lama_sprite"
for subdir in ['right', 'left']:
    d = os.path.join(base_dir, subdir)
    for mk in os.listdir(d):
        if mk.endswith('.png'):
            fix_png(os.path.join(d, mk))
