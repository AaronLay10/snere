# Mosquitto Password Configuration

## Creating Password File

The `mosquitto_passwd` file needs to be created before starting the MQTT broker.

### Initial Setup

```bash
# Create password file directory if it doesn't exist
mkdir -p /opt/sentient/config/mosquitto

# Create admin user
docker run --rm -v /opt/sentient/config/mosquitto:/mosquitto/config eclipse-mosquitto:2 \
  mosquitto_passwd -c -b /mosquitto/config/mosquitto_passwd admin your_admin_password

# Add service users
docker run --rm -v /opt/sentient/config/mosquitto:/mosquitto/config eclipse-mosquitto:2 \
  mosquitto_passwd -b /mosquitto/config/mosquitto_passwd sentient_api your_api_password

docker run --rm -v /opt/sentient/config/mosquitto:/mosquitto/config eclipse-mosquitto:2 \
  mosquitto_passwd -b /mosquitto/config/mosquitto_passwd sentient_executor your_executor_password

docker run --rm -v /opt/sentient/config/mosquitto:/mosquitto/config eclipse-mosquitto:2 \
  mosquitto_passwd -b /mosquitto/config/mosquitto_passwd sentient_monitor your_monitor_password

# Add client device users
docker run --rm -v /opt/sentient/config/mosquitto:/mosquitto/config eclipse-mosquitto:2 \
  mosquitto_passwd -b /mosquitto/config/mosquitto_passwd paragon_devices your_devices_password
```

### Production Setup (using .env values)

```bash
# Source the environment file
source /opt/sentient/.env.production

# Create users with passwords from environment
docker run --rm -v /opt/sentient/config/mosquitto:/mosquitto/config eclipse-mosquitto:2 \
  mosquitto_passwd -c -b /mosquitto/config/mosquitto_passwd admin $MQTT_PASSWORD

docker run --rm -v /opt/sentient/config/mosquitto:/mosquitto/config eclipse-mosquitto:2 \
  mosquitto_passwd -b /mosquitto/config/mosquitto_passwd sentient_api $MQTT_PASSWORD

docker run --rm -v /opt/sentient/config/mosquitto:/mosquitto/config eclipse-mosquitto:2 \
  mosquitto_passwd -b /mosquitto/config/mosquitto_passwd sentient_executor $MQTT_PASSWORD

docker run --rm -v /opt/sentient/config/mosquitto:/mosquitto/config eclipse-mosquitto:2 \
  mosquitto_passwd -b /mosquitto/config/mosquitto_passwd sentient_monitor $MQTT_PASSWORD

docker run --rm -v /opt/sentient/config/mosquitto:/mosquitto/config eclipse-mosquitto:2 \
  mosquitto_passwd -b /mosquitto/config/mosquitto_passwd paragon_devices $MQTT_PASSWORD
```

### Adding New Users

```bash
# Add a new user
docker run --rm -v /opt/sentient/config/mosquitto:/mosquitto/config eclipse-mosquitto:2 \
  mosquitto_passwd -b /mosquitto/config/mosquitto_passwd new_username new_password
```

### Updating Existing Password

```bash
# Update password
docker run --rm -v /opt/sentient/config/mosquitto:/mosquitto/config eclipse-mosquitto:2 \
  mosquitto_passwd -b /mosquitto/config/mosquitto_passwd existing_username new_password
```

### Deleting Users

```bash
# Delete user
docker run --rm -v /opt/sentient/config/mosquitto:/mosquitto/config eclipse-mosquitto:2 \
  mosquitto_passwd -D /mosquitto/config/mosquitto_passwd username_to_delete
```

## File Permissions

```bash
# Set proper permissions
chmod 600 /opt/sentient/config/mosquitto/mosquitto_passwd
chown 1883:1883 /opt/sentient/config/mosquitto/mosquitto_passwd
```

## Reload Configuration

After changing passwords or ACL, reload the Mosquitto configuration:

```bash
docker-compose restart mosquitto
```

## Testing MQTT Connection

```bash
# Subscribe to topics
mosquitto_sub -h localhost -p 1883 -u paragon_devices -P your_password -t 'paragon/#' -v

# Publish a message
mosquitto_pub -h localhost -p 1883 -u paragon_devices -P your_password \
  -t 'paragon/test/commands/test_controller/test_device/test_command' \
  -m '{"test":"message"}'
```