# Backup Verification Checklist

## Pre-Backup Verification

- [ ] All files exist in source locations
- [ ] Git status is clean (or changes committed)
- [ ] Tests are passing
- [ ] Build is successful

## Post-Backup Verification

- [ ] All 6 core files backed up
- [ ] All test files backed up
- [ ] MANIFEST.md created
- [ ] restore.ps1 created
- [ ] File sizes match originals
- [ ] No corruption in backed up files

## Backup Integrity

Run these commands to verify:

```powershell
Get-ChildItem core/*.ts | Measure-Object
Get-ChildItem services/*.ts | Measure-Object
Get-ChildItem tests/*.test.ts | Measure-Object
```
