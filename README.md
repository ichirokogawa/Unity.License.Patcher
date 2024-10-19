# Unity.License.Patcher

Used to fix the bug that Unity License cannot be loaded normally.

## Build status

[![release](https://github.com/ichirokogawa/Unity.License.Patcher/actions/workflows/release.yml/badge.svg?branch=main)](https://github.com/ichirokogawa/Unity.License.Patcher/actions/workflows/release.yml)

## Support environment

### System

- ✅ Windows

- ⬜ Mac(TODO)

### Unity version

- ✅ all

### UnityHub version

- ✅ v2.x

- ❓  v3.x(Unknown)

- ✅ v3.8

- ✅ V3.9

## Quick start


### 1. Method 1

Clone the code and execute it in the root directory of the repository.

#### UnityHub v3.8

- Patch

```
dotnet run patch --UnityFolder "C:\Program Files\Unity 6000.0.0b11" --UnityHubFolder "C:\Program Files\Unity Hub" --UnityHubVersion v3_8
```

- Restore

```
dotnet run restore --UnityFolder "C:\Program Files\Unity 6000.0.0b11" --UnityHubFolder "C:\Program Files\Unity Hub" --UnityHubVersion v3_8
```

#### UnityHub v2.x

- Patch

```
dotnet run patch --UnityFolder "C:\Program Files\Unity 6000.0.0b11" --UnityHubFolder "C:\Program Files\Unity Hub" --UnityHubVersion v2
```

- Restore

```
dotnet run restore --UnityFolder "C:\Program Files\Unity 6000.0.0b11" --UnityHubFolder "C:\Program Files\Unity Hub" --UnityHubVersion v2
```

