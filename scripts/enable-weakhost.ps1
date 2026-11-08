# Enable WeakHostSend and WeakHostReceive on physical interfaces
# This allows localAddress binding to actually route through the correct NIC

$ifaces = Get-NetIPInterface -AddressFamily IPv4 | Where-Object {
    ($_.InterfaceAlias -match 'Ethernet$|Wi-Fi') -and
    ($_.ConnectionState -eq 'Connected')
}

foreach ($iface in $ifaces) {
    Set-NetIPInterface -InterfaceIndex $iface.InterfaceIndex `
        -WeakHostSend Enabled `
        -WeakHostReceive Enabled `
        -ErrorAction SilentlyContinue
}
