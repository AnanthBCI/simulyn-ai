FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Build-time proxy plumbing — needed for `dotnet restore` to fetch nuget
# packages from behind a corporate proxy. Pass these in via docker-compose
# build args (defaults to empty if not set).
ARG HTTP_PROXY=
ARG HTTPS_PROXY=
ARG NO_PROXY=
ENV HTTP_PROXY=$HTTP_PROXY \
    HTTPS_PROXY=$HTTPS_PROXY \
    NO_PROXY=$NO_PROXY \
    http_proxy=$HTTP_PROXY \
    https_proxy=$HTTPS_PROXY \
    no_proxy=$NO_PROXY

COPY Simulyn.Api/Simulyn.Api.csproj Simulyn.Api/
COPY Simulyn.Api/ Simulyn.Api/
RUN dotnet publish Simulyn.Api/Simulyn.Api.csproj -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
ENTRYPOINT ["dotnet", "Simulyn.Api.dll"]
