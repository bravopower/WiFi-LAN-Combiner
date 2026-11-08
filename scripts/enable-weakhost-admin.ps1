# Must run as Administrator
# Enable WeakHostSend/Receive for Ethernet and Wi-Fi
$ifaces = Get-NetIPInterface -AddressFamily IPv4 | Where-Object {
    $_.InterfaceAlias -eq 'Ethernet' -or $_.InterfaceAlias -eq 'Wi-Fi'
}

foreach ($iface in $ifaces) {
    Write-Host "Enabling WeakHost for: $($iface.InterfaceAlias) [Index: $($iface.InterfaceIndex)]"
    Set-NetIPInterface -InterfaceIndex $iface.InterfaceIndex `
        -WeakHostSend Enabled `
        -WeakHostReceive Enabled `
        -ErrorAction SilentlyContinue
}

Write-Host "Done."
