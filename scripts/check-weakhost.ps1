Get-NetIPInterface -AddressFamily IPv4 | Select-Object InterfaceAlias, WeakHostSend, WeakHostReceive | Format-Table -AutoSize
