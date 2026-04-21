# Use the official Nginx image as the base image
FROM nginx:alpine

# Remove the default Nginx configuration file
RUN rm /etc/nginx/conf.d/default.conf

# Copy our custom Nginx configuration file
COPY nginx.conf /etc/nginx/conf.d/

# Copy the static website files to the Nginx html directory
COPY . /usr/share/nginx/html

# Expose port 8080 (Cloud Run's default port)
EXPOSE 8080

# Start Nginx in the foreground
CMD ["nginx", "-g", "daemon off;"]
