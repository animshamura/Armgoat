# Build context is the repository root (see docker-compose.yml)
# Stage 1: Build
FROM golang:1.22-alpine AS builder
WORKDIR /app

COPY go.mod ./
COPY pkg ./pkg
COPY backend ./backend
RUN go mod tidy
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /server ./backend

# Stage 2: Runtime
FROM alpine:3.20
RUN apk --no-cache add ca-certificates tzdata
WORKDIR /root/
COPY --from=builder /server .

EXPOSE 8080
CMD ["./server"]
