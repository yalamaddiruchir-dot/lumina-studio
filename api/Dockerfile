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
ENV MAVEN_OPTS="-Xmx768m -XX:+UseSerialGC"
COPY api/pom.xml .
COPY api/src ./src
# Bundle the built frontend into the jar (served from classpath: no fragile disk paths)
COPY --from=client /app/client/dist ./src/main/resources/static
RUN mvn -B package -DskipTests

# ---------- Stage 3: slim runtime (API + frontend in one image) ----------
FROM eclipse-temurin:21-jre-jammy AS runtime
ENV NODE_ENV=production
ENV PORT=3001
WORKDIR /app

RUN groupadd -r lumina && useradd -r -g lumina -d /app lumina

COPY --from=build /app/target/lumina-api.jar ./app.jar

RUN chown -R lumina:lumina /app
USER lumina

EXPOSE 3001
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
