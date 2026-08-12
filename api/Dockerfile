# ---------- Stage 1: build the React frontend ----------
FROM node:22-alpine AS client
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client .
RUN npm run build

# ---------- Stage 2: build the Spring Boot API ----------
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY api/pom.xml .
RUN mvn -q dependency:go-offline
COPY api/src ./src
RUN mvn -q package -DskipTests

# ---------- Stage 3: slim runtime (API + frontend in one image) ----------
FROM eclipse-temurin:21-jre-jammy AS runtime
ENV NODE_ENV=production
ENV PORT=3001
WORKDIR /app

RUN groupadd -r lumina && useradd -r -g lumina -d /app lumina

COPY --from=build /app/target/lumina-api.jar ./app.jar
COPY --from=client /app/client/dist ./client/dist

RUN chown -R lumina:lumina /app
USER lumina

EXPOSE 3001
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
